from ultralytics import YOLO
import cv2
import datetime
import json
import numpy as np
import tempfile
from fastapi import FastAPI, File, UploadFile, Body
from pydantic import BaseModel
from pytube import YouTube
import torch
from typing import List, Optional
from starlette.responses import JSONResponse
from cap_from_youtube import cap_from_youtube

# Initialize FastAPI app
app = FastAPI()

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
model = YOLO("yolov8m.pt")

class ProcessRequest(BaseModel):
    url: str = None


class URLRequest(BaseModel):
    url: str



@app.post("/process_file")
async def process_file(
    file: UploadFile = File(...)
):
    contents = await file.read()
    # Try to read as an image
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is not None:
        # Process as image
        results = model(img)
        # Collect labels and detections
        detections = json.loads(results[0].tojson())
        # Return JSON with labels and detections
        return detections
    else:
        # Assume it's a video file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp:
            temp.write(contents)
            temp_filename = temp.name
        cap = cv2.VideoCapture(temp_filename)
        detections = await process_video(cap)
        cap.release()
        import os
        os.remove(temp_filename)
        return detections


class URLRequest(BaseModel):
    url: str


@app.post("/process_url")
async def process_url(
    url_request: URLRequest
):
    url = url_request.url
    if "youtube.com" in url or "youtu.be" in url:
        
        cap = cap_from_youtube(url, "720p")
        detections = await process_video(cap)
        cap.release()
        # os.remove(temp_video_file.name)
        return detections
    else:
        return JSONResponse(content={"error": "Invalid URL"}, status_code=400)


async def process_video(cap):
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
        results = model(frame)
        detections = json.loads(results[0].tojson())
        for detection in detections:
            detection['timestamp'] = timestamp
            all_detections.append(detection)
        frame_count += 1
    cap.release()
    return all_detections


@app.get("/health")
async def health_check():
    return "OK"