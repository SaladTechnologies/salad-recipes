from ultralytics import YOLO
import cv2
import json
import numpy as np
import tempfile
from fastapi import FastAPI, File, UploadFile, Query, Request
from fastapi.responses import StreamingResponse
import io
from pydantic import BaseModel
import torch
from typing import Optional
from starlette.responses import JSONResponse
from cap_from_youtube import cap_from_youtube
import requests
import os


# Initialize FastAPI app
app = FastAPI()

model = os.getenv("MODEL", "yolov8m.pt")

if torch.cuda.is_available():
        # Find which gpu is the best 
        best_gpu = None
        max_memory = 0
        for i in range(torch.cuda.device_count()):
            props = torch.cuda.get_device_properties(i)
            if props.total_memory > max_memory:
                max_memory = props.total_memory
                best_gpu = i
        
        if best_gpu is not None:
            torch.cuda.set_device(best_gpu)

# Load the YOLOv8 model
model = YOLO(model)


# Define valid types for parameters
TRACK_KWARGS = {
    "tracker_type": str,
    "track_high_thresh": float,
    "track_low_thresh": float,
    "new_track_thresh": float,
    "track_buffer": int,
    "match_thresh": float,
    "fuse_score": lambda v: v.lower() == "true" if isinstance(v, str) else bool(v),
    "gmc_method": str,
    "proximity_thresh": float,
    "appearance_thresh": float,
    "with_reid": lambda v: v.lower() == "true" if isinstance(v, str) else bool(v)
    }

PREDICT_KWARGS = {
    "conf": float,
    "iou": float,
    "imgsz": int,
    "rect": lambda v: v.lower() == "true" if isinstance(v, str) else bool(v),
    "half": lambda v: v.lower() == "true" if isinstance(v, str) else bool(v),
    "batch": int,
    "max_det": int,
    "vid_stride": int,
    "stream_buffer": lambda v: v.lower() == "true" if isinstance(v, str) else bool(v),
    "visualize": lambda v: v.lower() == "true" if isinstance(v, str) else bool(v),
    "augment": lambda v: v.lower() == "true" if isinstance(v, str) else bool(v),
    "agnostic_nms": lambda v: v.lower() == "true" if isinstance(v, str) else bool(v),
    "retina_masks": lambda v: v.lower() == "true" if isinstance(v, str) else bool(v),
    "project": str,
    "name": str,
    "stream": lambda v: v.lower() == "true" if isinstance(v, str) else bool(v),
    "verbose": lambda v: v.lower() == "true" if isinstance(v, str) else bool(v)
}

ALL_KWARGS = {**TRACK_KWARGS, **PREDICT_KWARGS}

def parse_kwargs(params):
    valid = {}
    for k, v in params.items():
        if k in ALL_KWARGS:
            try:
                valid[k] = ALL_KWARGS[k](v)
            except Exception:
                continue
    return valid

async def process_video_annotated(cap, track, tracker, **kwargs):
    width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30

    out_temp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    out_path = out_temp.name

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(out_path, fourcc, fps, (width, height))

    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break
        if track:
            results = model.track(frame, tracker=tracker, **kwargs)
        else:
            results = model.predict(frame, **kwargs)
        annotated = results[0].plot()
        out.write(annotated)

    out.release()
    return out_path


async def process_video(cap, track, tracker, **kwargs):
    all_detections = []
    frame_count = 0
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0 or fps is None or np.isnan(fps):
        fps = 30  # Default to 30 FPS if unable to get FPS
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break
        timestamp = frame_count / fps
        if track:
            results = model.track(frame,  tracker=tracker, **kwargs)
        else:
            results = model.predict(frame,  **kwargs)
        detections = json.loads(results[0].tojson())
        for detection in detections:
            detection['timestamp'] = timestamp
            all_detections.append(detection)
        frame_count += 1
    cap.release()
    return all_detections


@app.post("/process_file")
async def process_file(
    request: Request,
    file: UploadFile = File(...),
    annotated: bool = Query(False),
    track: bool = Query(False),
    tracker: Optional[str] = Query("bytetrack.yaml"),

):
    contents = await file.read()
    # Remove the known parameters so only YOLO ones remain
    # Get all query params, strip the known ones
    params = dict(request.query_params)
    for key in ["annotated", "track", "tracker"]:
        params.pop(key, None)

    # Convert to float if possible
    extra_params = parse_kwargs(params)

    # Try to read as an image
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is not None:
        # Process as image
        results = model.predict(img, **extra_params)
        if annotated:
            annotated_img = results[0].plot()
            _, buffer = cv2.imencode('.jpg', annotated_img)
            return StreamingResponse(io.BytesIO(buffer), media_type="image/jpeg")
        else:
            # Collect labels and detections
            detections = json.loads(results[0].tojson())
            # Return JSON with labels and detections
            return detections
    # Assume it's a video file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp:
        temp.write(contents)
        temp_filename = temp.name
        cap = cv2.VideoCapture(temp_filename)
        if annotated:
            output_path = await process_video_annotated(cap, track, tracker, **extra_params)
            cap.release()
            os.remove(temp_filename)

            def iterfile():
                with open(output_path, "rb") as f:
                    yield from f
                os.remove(output_path)

            return StreamingResponse(iterfile(), media_type="video/mp4")
        else:
            detections = await process_video(cap, track, tracker, **extra_params)
            cap.release()
            os.remove(temp_filename)
            return detections


class URLRequest(BaseModel):
    url: str


@app.post("/process_url")
async def process_url(
    request: Request,
    url_request: URLRequest,
    annotated: bool = Query(False),
    track: bool = Query(False),
    tracker: Optional[str] = Query("bytetrack.yaml"),
):
    url = url_request.url
    try:
        # Remove the known parameters so only YOLO ones remain
        # Get all query params, strip the known ones
        params = dict(request.query_params)
        for key in ["annotated", "track", "tracker"]:
            params.pop(key, None)

        # Convert to float if possible
        extra_params = parse_kwargs(params)

        if "youtube.com" in url or "youtu.be" in url:
            cap = cap_from_youtube(url, "720p")
            if annotated:
                output_path = await process_video_annotated(cap, track, tracker, **extra_params)
                cap.release()
                def iterfile():
                    with open(output_path, "rb") as f:
                        yield from f
                    os.remove(output_path)

                return StreamingResponse(iterfile(), media_type="video/mp4")
            else:
                detections = await process_video(cap, track, tracker, **extra_params)
                cap.release()
                return detections
        else:
            response = requests.get(url, stream=True)
            content_type = response.headers.get('Content-Type', '')

            if 'image' in content_type:
                # Handle image
                img_array = np.asarray(bytearray(response.content), dtype=np.uint8)
                img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
                if img is not None:
                    results = model.predict(img, **extra_params)
                    if annotated:
                        annotated_img = results[0].plot()
                        _, buffer = cv2.imencode('.jpg', annotated_img)
                        return StreamingResponse(io.BytesIO(buffer), media_type="image/jpeg")
                    else:
                        detections = json.loads(results[0].tojson())
                        return detections
                else:
                    return JSONResponse(content={"error": "Could not decode the image"}, status_code=400)

            elif 'video' in content_type or url.endswith(('.mp4', '.webm', '.mov', '.mkv')):
                # Handle direct video URL
                tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
                with open(tmp.name, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                cap = cv2.VideoCapture(tmp.name)

                if annotated:
                    output_path = await process_video_annotated(cap, track, tracker, **extra_params)
                    cap.release()
                    def iterfile():
                        with open(output_path, "rb") as f:
                            yield from f
                        os.remove(output_path)
                        os.remove(tmp.name)
                    return StreamingResponse(iterfile(), media_type="video/mp4")
                else:
                    detections = await process_video(cap, track, tracker, **extra_params)
                    cap.release()
                    os.remove(tmp.name)
                    return detections

            else:
                return JSONResponse(content={"error": "Invalid URL: Not an image or video format we support"}, status_code=400)

    except Exception as e:
        return JSONResponse(content={"error": f"An error occurred: {str(e)}"}, status_code=500)


@app.get("/health")
async def health_check():
    return "OK"