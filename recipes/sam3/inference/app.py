import cv2
import json
import numpy as np
from fastapi import FastAPI, File, UploadFile, Query, Request, Form
from fastapi.responses import StreamingResponse
import io
from pydantic import BaseModel
import torch
from typing import Optional, List
from starlette.responses import JSONResponse
import requests
import os
from pathlib import Path

# Initialize FastAPI app
app = FastAPI(
    title="SAM3 Segmentation API",
    description="Segment Anything Model 3 - Zero-shot image segmentation with point, box, and text prompts",
    version="1.0.0"
)

# Model configuration
MODEL_NAME = os.getenv("MODEL", "sam3.pt")
HF_TOKEN = os.getenv("HF_TOKEN") or os.getenv("HUGGING_FACE_HUB_TOKEN")
MODEL_CACHE_DIR = os.getenv("MODEL_CACHE_DIR")  # None if not set, uses library defaults

# Lazy-loaded model instances
_sam_model = None
_semantic_predictor = None
_model_path = None


def download_sam3_model():
    """Download SAM3 model from HuggingFace if not present."""
    global _model_path

    if _model_path and Path(_model_path).exists():
        return _model_path

    # Only use custom cache dir if explicitly set
    if MODEL_CACHE_DIR:
        cache_path = Path(MODEL_CACHE_DIR)
        cache_path.mkdir(parents=True, exist_ok=True)
        local_path = cache_path / MODEL_NAME

        if local_path.exists():
            print(f"Model already exists at {local_path}")
            _model_path = str(local_path)
            return _model_path

    print(f"Downloading SAM3 model from HuggingFace...")
    try:
        from huggingface_hub import hf_hub_download

        # SAM3 model repository on HuggingFace
        download_kwargs = {
            "repo_id": "facebook/sam3",
            "filename": MODEL_NAME,
            "token": HF_TOKEN,
        }
        
        # Only set cache_dir if MODEL_CACHE_DIR is specified
        if MODEL_CACHE_DIR:
            download_kwargs["cache_dir"] = MODEL_CACHE_DIR
            download_kwargs["local_dir"] = MODEL_CACHE_DIR

        downloaded_path = hf_hub_download(**download_kwargs)
        _model_path = downloaded_path
        print(f"Model downloaded to {_model_path}")
        return _model_path
    except Exception as e:
        print(f"Failed to download from HuggingFace: {e}")
        # Fallback: try using the model name directly (Ultralytics may download it)
        _model_path = MODEL_NAME
        return _model_path


def get_sam_model():
    """Lazy load SAM model for point/box prompts."""
    global _sam_model
    if _sam_model is None:
        from ultralytics import SAM
        model_path = download_sam3_model()
        _sam_model = SAM(model_path)
    return _sam_model


def get_semantic_predictor():
    """Lazy load SAM3SemanticPredictor for text prompts."""
    global _semantic_predictor
    if _semantic_predictor is None:
        from ultralytics.models.sam import SAM3SemanticPredictor
        model_path = download_sam3_model()
        overrides = dict(
            conf=0.25,
            task="segment",
            mode="predict",
            model=model_path,
            save=False,
        )
        _semantic_predictor = SAM3SemanticPredictor(overrides=overrides)
    return _semantic_predictor


def encode_mask_rle(mask: np.ndarray) -> dict:
    """Encode binary mask to RLE format."""
    pixels = mask.flatten()
    pixels = np.concatenate([[0], pixels, [0]])
    runs = np.where(pixels[1:] != pixels[:-1])[0] + 1
    runs[1::2] -= runs[::2]
    return {
        "counts": runs.tolist(),
        "size": list(mask.shape)
    }


def process_segmentation_visual(image: np.ndarray, points: Optional[List] = None,
                                labels: Optional[List] = None, boxes: Optional[List] = None):
    """Process image with SAM model using point/box prompts."""
    model = get_sam_model()
    kwargs = {}

    if points is not None and labels is not None:
        kwargs["points"] = points
        kwargs["labels"] = labels

    if boxes is not None:
        kwargs["bboxes"] = boxes

    results = model(image, **kwargs)
    return results


def process_segmentation_text(image: np.ndarray, text: str):
    """Process image with SAM3SemanticPredictor using text prompt."""
    predictor = get_semantic_predictor()
    predictor.set_image(image)

    # Handle single or multiple text prompts
    text_list = [t.strip() for t in text.split(",")] if "," in text else [text]
    results = predictor(text=text_list)
    return results


def results_to_json(results) -> List[dict]:
    """Convert SAM results to JSON-serializable format."""
    output = []

    for result in results:
        if result.masks is not None:
            masks_data = result.masks.data.cpu().numpy()
            for i, mask in enumerate(masks_data):
                mask_dict = {
                    "mask_rle": encode_mask_rle(mask.astype(np.uint8)),
                    "area": int(mask.sum()),
                }

                # Add bounding box if available
                if result.boxes is not None and i < len(result.boxes):
                    box = result.boxes[i]
                    mask_dict["bbox"] = box.xyxy[0].cpu().numpy().tolist()
                    if box.conf is not None:
                        mask_dict["confidence"] = float(box.conf[0])

                output.append(mask_dict)

    return output


def create_annotated_image(image: np.ndarray, results) -> np.ndarray:
    """Create annotated image with mask overlays."""
    annotated = image.copy()

    for result in results:
        if result.masks is not None:
            masks_data = result.masks.data.cpu().numpy()
            for mask in masks_data:
                # Generate random color for each mask
                color = np.random.randint(0, 255, 3).tolist()

                # Create colored overlay
                overlay = annotated.copy()
                overlay[mask.astype(bool)] = color

                # Blend with original
                annotated = cv2.addWeighted(annotated, 0.7, overlay, 0.3, 0)

                # Draw contours
                contours, _ = cv2.findContours(
                    mask.astype(np.uint8),
                    cv2.RETR_EXTERNAL,
                    cv2.CHAIN_APPROX_SIMPLE
                )
                cv2.drawContours(annotated, contours, -1, color, 2)

    return annotated


class SegmentURLRequest(BaseModel):
    url: str
    points: Optional[List[List[float]]] = None
    labels: Optional[List[int]] = None
    boxes: Optional[List[List[float]]] = None
    text: Optional[str] = None


@app.post("/segment_file")
async def segment_file(
    request: Request,
    file: UploadFile = File(...),
    points: Optional[str] = Form(None),
    labels: Optional[str] = Form(None),
    boxes: Optional[str] = Form(None),
    text: Optional[str] = Form(None),
    annotated: bool = Query(False),
):
    """
    Segment an uploaded image file.

    - **file**: Image file to segment
    - **points**: JSON array of point coordinates [[x, y], ...]
    - **labels**: JSON array of point labels [1, 0, ...] (1=foreground, 0=background)
    - **boxes**: JSON array of bounding boxes [[x1, y1, x2, y2], ...]
    - **text**: Text prompt for open-vocabulary segmentation (comma-separated for multiple)
    - **annotated**: If true, return image with mask overlay; if false, return JSON
    """
    contents = await file.read()

    # Parse JSON string inputs
    parsed_points = json.loads(points) if points else None
    parsed_labels = json.loads(labels) if labels else None
    parsed_boxes = json.loads(boxes) if boxes else None

    # Decode image
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return JSONResponse(content={"error": "Could not decode image"}, status_code=400)

    try:
        # Use text predictor if text prompt provided, otherwise use visual prompts
        if text:
            results = process_segmentation_text(img, text)
        else:
            results = process_segmentation_visual(
                img,
                points=parsed_points,
                labels=parsed_labels,
                boxes=parsed_boxes
            )

        if annotated:
            annotated_img = create_annotated_image(img, results)
            _, buffer = cv2.imencode('.png', annotated_img)
            return StreamingResponse(io.BytesIO(buffer), media_type="image/png")
        else:
            detections = results_to_json(results)
            return detections

    except Exception as e:
        import traceback
        return JSONResponse(
            content={"error": f"Segmentation failed: {str(e)}", "traceback": traceback.format_exc()},
            status_code=500
        )


@app.post("/segment_url")
async def segment_url(
    request: SegmentURLRequest,
    annotated: bool = Query(False),
):
    """
    Segment an image from URL.

    - **url**: URL of the image to segment
    - **points**: Array of point coordinates [[x, y], ...]
    - **labels**: Array of point labels [1, 0, ...] (1=foreground, 0=background)
    - **boxes**: Array of bounding boxes [[x1, y1, x2, y2], ...]
    - **text**: Text prompt for open-vocabulary segmentation (comma-separated for multiple)
    - **annotated**: If true, return image with mask overlay; if false, return JSON
    """
    try:
        response = requests.get(request.url, stream=True, timeout=30)
        response.raise_for_status()

        content_type = response.headers.get('Content-Type', '')

        if 'image' not in content_type and not request.url.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.bmp')):
            return JSONResponse(content={"error": "URL does not point to an image"}, status_code=400)

        img_array = np.asarray(bytearray(response.content), dtype=np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

        if img is None:
            return JSONResponse(content={"error": "Could not decode image from URL"}, status_code=400)

        # Use text predictor if text prompt provided, otherwise use visual prompts
        if request.text:
            results = process_segmentation_text(img, request.text)
        else:
            results = process_segmentation_visual(
                img,
                points=request.points,
                labels=request.labels,
                boxes=request.boxes
            )

        if annotated:
            annotated_img = create_annotated_image(img, results)
            _, buffer = cv2.imencode('.png', annotated_img)
            return StreamingResponse(io.BytesIO(buffer), media_type="image/png")
        else:
            detections = results_to_json(results)
            return detections

    except requests.exceptions.RequestException as e:
        return JSONResponse(content={"error": f"Failed to fetch image: {str(e)}"}, status_code=400)
    except Exception as e:
        import traceback
        return JSONResponse(
            content={"error": f"Segmentation failed: {str(e)}", "traceback": traceback.format_exc()},
            status_code=500
        )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return "OK"


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "SAM3 Segmentation API",
        "version": "1.0.0",
        "model": MODEL_NAME,
        "endpoints": {
            "/segment_file": "POST - Segment uploaded image",
            "/segment_url": "POST - Segment image from URL",
            "/health": "GET - Health check",
            "/docs": "GET - Swagger API documentation"
        }
    }


@app.on_event("startup")
async def startup_event():
    """Preload model on startup for faster first request."""
    try:
        print(f"Loading SAM model: {MODEL_NAME}")
        get_sam_model()
        print("SAM model loaded successfully")
    except Exception as e:
        print(f"Warning: Could not preload SAM model: {e}")
        print("Model will be loaded on first request")
