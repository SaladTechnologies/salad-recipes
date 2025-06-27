from ultralytics import YOLO
import cv2
import datetime
import json
import numpy as np
import tempfile
from fastapi import FastAPI, File, UploadFile, Body, Query
from fastapi.responses import StreamingResponse
import io
from pydantic import BaseModel
from pytube import YouTube
import torch
from typing import List, Optional
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
device = 'cuda' if torch.cuda.is_available() else 'cpu'

# Load the YOLOv8 model
model = YOLO(model)

async def process_video_annotated(cap, conf, iou, imgsz, track, tracker, device=device):
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
            results = model.track(frame, conf=conf, iou=iou, imgsz=imgsz, tracker=tracker, device=device)
        else:
            results = model.predict(frame, conf=conf, iou=iou, imgsz=imgsz, device=device)
        annotated = results[0].plot()
        out.write(annotated)

    out.release()
    return out_path


async def process_video(cap, conf, iou, imgsz, track, tracker, device=device):
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
            results = model.track(frame, conf=conf, iou=iou, imgsz=imgsz, tracker=tracker, device=device)
        else:
            results = model.predict(frame, conf=conf, iou=iou, imgsz=imgsz, device=device)
        detections = json.loads(results[0].tojson())
        for detection in detections:
            detection['timestamp'] = timestamp
            all_detections.append(detection)
        frame_count += 1
    cap.release()
    return all_detections




@app.post("/process_file")
async def process_file(
    file: UploadFile = File(...),
    annotated: bool = Query(False),
    conf: float = Query(0.25),
    iou: float = Query(0.7),
    imgsz: int = Query(640),
    track: bool = Query(False),
    tracker: Optional[str] = Query("bytetrack.yaml")
):
    contents = await file.read()
    # Try to read as an image
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is not None:
        # Process as image
        results = model.predict(img, conf=conf, iou=iou, imgsz=imgsz, device=device)
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
            output_path = await process_video_annotated(cap, conf, iou, imgsz, track, tracker, device=device)
            cap.release()
            os.remove(temp_filename)

            def iterfile():
                with open(output_path, "rb") as f:
                    yield from f
                os.remove(output_path)

            return StreamingResponse(iterfile(), media_type="video/mp4")
        else:
            detections = await process_video(cap, conf, iou, imgsz, track, tracker, device=device)
            cap.release()
            os.remove(temp_filename)
            return detections


class URLRequest(BaseModel):
    url: str


@app.post("/process_url")
async def process_url(
    url_request: URLRequest,
    annotated: bool = Query(False),
    conf: float = Query(0.25),
    iou: float = Query(0.7),
    imgsz: int = Query(640),
    track: bool = Query(False),
    tracker: Optional[str] = Query("bytetrack.yaml")
):
    url = url_request.url
    try:
        if "youtube.com" in url or "youtu.be" in url:
            cap = cap_from_youtube(url, "720p")
            if annotated:
                output_path = await process_video_annotated(cap, conf, iou, imgsz, track, tracker, device=device)
                cap.release()
                def iterfile():
                    with open(output_path, "rb") as f:
                        yield from f
                    os.remove(output_path)

                return StreamingResponse(iterfile(), media_type="video/mp4")
            else:
                detections = await process_video(cap, conf, iou, imgsz, track, tracker, device=device)
                cap.release()
                return detections
        else:
            # Check if the URL is an image
            response = requests.get(url, stream=True)
            content_type = response.headers.get('Content-Type', '')
            if 'image' in content_type:
                # Download the image
                img_array = np.asarray(bytearray(response.content), dtype=np.uint8)
                img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
                if img is not None:
                    # Process as image
                    results = model.predict(img, conf=conf, iou=iou, imgsz=imgsz, device=device)
                    if annotated:
                        annotated_img = results[0].plot()
                        _, buffer = cv2.imencode('.jpg', annotated_img)
                        return StreamingResponse(io.BytesIO(buffer), media_type="image/jpeg")
                    else:
                        # Collect labels and detections
                        detections = json.loads(results[0].tojson())
                        # Return JSON with labels and detections
                        return detections

            else:
                return JSONResponse(content={"error": "Could not decode the image"}, status_code=400)
            # else:
            #     return JSONResponse(content={"error": "Invalid URL: Not an image or YouTube video"}, status_code=400)
    except Exception as e:
        return JSONResponse(content={"error": f"An error occurred: {str(e)}"}, status_code=500)


@app.get("/health")
async def health_check():
    return "OK"