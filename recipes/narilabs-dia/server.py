import asyncio
import base64
import io
import logging
import os
import random
import tempfile
import time
from pathlib import Path
from typing import Literal, Optional, Tuple

import numpy as np
import requests
import soundfile as sf
import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, HttpUrl
from starlette.concurrency import run_in_threadpool

from dia.model import Dia, DEFAULT_SAMPLE_RATE


logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("narilabs-dia")

MODEL_ID = os.getenv("DIA_MODEL_ID", "nari-labs/Dia-1.6B-0626")
MODEL_PATH = os.getenv("DIA_MODEL_PATH")
COMPUTE_DTYPE = os.getenv("DIA_COMPUTE_DTYPE", "float16")
DEVICE_OVERRIDE = os.getenv("DIA_DEVICE")
DEFAULT_MAX_NEW_TOKENS = int(os.getenv("DIA_MAX_NEW_TOKENS", "3072"))
DEFAULT_CFG_SCALE = float(os.getenv("DIA_CFG_SCALE", "3.0"))
DEFAULT_TEMPERATURE = float(os.getenv("DIA_TEMPERATURE", "1.4"))
DEFAULT_TOP_P = float(os.getenv("DIA_TOP_P", "0.90"))
DEFAULT_CFG_FILTER_TOP_K = int(os.getenv("DIA_CFG_FILTER_TOP_K", "45"))
DEFAULT_SPEED_FACTOR = float(os.getenv("DIA_SPEED_FACTOR", "1.0"))
DEFAULT_USE_TORCH_COMPILE = os.getenv("DIA_USE_TORCH_COMPILE", "false").lower() in {"1", "true", "yes"}
REQUEST_TIMEOUT = int(os.getenv("DIA_AUDIO_PROMPT_TIMEOUT", "30"))

if os.getenv("HF_TOKEN") and not os.getenv("HUGGING_FACE_HUB_TOKEN"):
    os.environ["HUGGING_FACE_HUB_TOKEN"] = os.environ["HF_TOKEN"]


def resolve_device() -> torch.device:
    if DEVICE_OVERRIDE:
        try:
            return torch.device(DEVICE_OVERRIDE)
        except (TypeError, RuntimeError) as exc:
            logger.warning("Falling back to auto device selection: %s", exc)
    if torch.cuda.is_available():
        cuda_device = torch.device("cuda")
        logger.info("CUDA detected, using device %s", cuda_device)
        return cuda_device
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        mps_device = torch.device("mps")
        logger.info("MPS detected, using device %s", mps_device)
        return mps_device
    cpu_device = torch.device("cpu")
    logger.info("Defaulting to CPU device %s", cpu_device)
    return cpu_device


DEVICE = resolve_device()

_model: Optional[Dia] = None
_model_ready: bool = False
_startup_error: Optional[str] = None
_load_lock = asyncio.Lock()
_generation_lock = asyncio.Lock()


class GenerateRequest(BaseModel):
    text: str = Field(..., description="Dialogue prompt that must start with speaker tags like [S1]")
    audio_prompt_text: Optional[str] = Field(
        default=None,
        description="Transcript corresponding to the provided audio prompt. Required when audio_prompt_b64 or audio_prompt_url is set.",
    )
    audio_prompt_b64: Optional[str] = Field(
        default=None,
        description="Base64 encoded WAV audio used to condition the generation.",
    )
    audio_prompt_url: Optional[HttpUrl] = Field(
        default=None,
        description="Public URL to a WAV/MP3 audio file used for conditioning.",
    )
    max_new_tokens: Optional[int] = Field(
        default=None,
        ge=1,
        le=4096,
        description="Maximum number of audio tokens to synthesize.",
    )
    cfg_scale: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=10.0,
        description="Classifier-free guidance scale.",
    )
    temperature: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=5.0,
        description="Sampling temperature.",
    )
    top_p: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Top-p sampling threshold.",
    )
    cfg_filter_top_k: Optional[int] = Field(
        default=None,
        ge=1,
        le=256,
        description="Number of logits to consider during CFG filtering.",
    )
    speed_factor: Optional[float] = Field(
        default=None,
        gt=0.0,
        le=5.0,
        description="Playback speed factor applied after generation (1.0 = real-time).",
    )
    seed: Optional[int] = Field(
        default=None,
        ge=0,
        description="Random seed for deterministic outputs.",
    )
    verbose: bool = Field(
        default=False,
        description="If true, logs verbose generation progress to stdout.",
    )
    response_format: Literal["json", "wav"] = Field(
        default="json",
        description="Set to 'wav' to receive a streamed audio response instead of JSON.",
    )

    def effective_max_tokens(self) -> int:
        return self.max_new_tokens or DEFAULT_MAX_NEW_TOKENS

    def effective_cfg_scale(self) -> float:
        return self.cfg_scale if self.cfg_scale is not None else DEFAULT_CFG_SCALE

    def effective_temperature(self) -> float:
        return self.temperature if self.temperature is not None else DEFAULT_TEMPERATURE

    def effective_top_p(self) -> float:
        return self.top_p if self.top_p is not None else DEFAULT_TOP_P

    def effective_cfg_filter_top_k(self) -> int:
        return self.cfg_filter_top_k or DEFAULT_CFG_FILTER_TOP_K

    def effective_speed_factor(self) -> float:
        value = self.speed_factor if self.speed_factor is not None else DEFAULT_SPEED_FACTOR
        return max(0.1, min(value, 5.0))


class GenerateResponse(BaseModel):
    audio_base64: str
    sample_rate: int
    duration_seconds: float
    seed: int
    generation_seconds: float
    model_id: str = Field(default=MODEL_ID)


app = FastAPI(
    title="Nari Labs Dia",
    description="Serve the Nari Labs Dia 1.6B text-to-dialogue model over a simple HTTP API.",
    version="0.1.0",
)


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed(seed)
        torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def _load_model_sync() -> None:
    global _model
    if MODEL_PATH:
        model_dir = Path(MODEL_PATH)
    else:
        model_dir = None

    if model_dir and model_dir.is_dir():
        config_path = model_dir / "config.json"
        checkpoint_path = None
        for candidate in ("dia-v1.pth", "pytorch_model.bin"):
            candidate_path = model_dir / candidate
            if candidate_path.exists():
                checkpoint_path = candidate_path
                break

        if config_path.exists() and checkpoint_path:
            logger.info(
                "Loading Dia model from local files config=%s checkpoint=%s device=%s dtype=%s torch_compile=%s",
                config_path,
                checkpoint_path,
                DEVICE,
                COMPUTE_DTYPE,
                DEFAULT_USE_TORCH_COMPILE,
            )
            _model = Dia.from_local(
                str(config_path),
                str(checkpoint_path),
                compute_dtype=COMPUTE_DTYPE,
                device=DEVICE,
            )
            return
        else:
            logger.warning(
                "Local model directory %s missing config or checkpoint; falling back to hub. Found config=%s checkpoint=%s",
                model_dir,
                config_path.exists(),
                bool(checkpoint_path),
            )

    model_source = MODEL_ID
    logger.info(
        "Loading Dia model '%s' from Hugging Face Hub on device=%s with dtype=%s (torch_compile=%s)",
        model_source,
        DEVICE,
        COMPUTE_DTYPE,
        DEFAULT_USE_TORCH_COMPILE,
    )
    _model = Dia.from_pretrained(model_source, compute_dtype=COMPUTE_DTYPE, device=DEVICE)
    _model.model.eval()
    logger.info("Model loaded successfully")


@app.on_event("startup")
async def startup_event() -> None:
    global _model_ready, _startup_error
    async with _load_lock:
        if _model_ready or _startup_error:
            return
        try:
            await run_in_threadpool(_load_model_sync)
            _model_ready = True
        except Exception as exc:
            _startup_error = str(exc)
            logger.exception("Failed to load Dia model: %s", exc)
            raise


@app.get("/health")
async def healthcheck():
    if _startup_error:
        raise HTTPException(status_code=500, detail={"status": "error", "message": _startup_error})
    if not _model_ready:
        raise HTTPException(status_code=425, detail={"status": "starting"})
    return {"status": "ok", "model_id": MODEL_ID}


def _validate_text(request: GenerateRequest) -> str:
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text prompt cannot be empty.")
    return text


def _prepare_audio_prompt(request: GenerateRequest) -> Optional[str]:
    prompt_sources = [bool(request.audio_prompt_b64), bool(request.audio_prompt_url)]
    if sum(prompt_sources) > 1:
        raise HTTPException(status_code=400, detail="Provide only one audio prompt source.")
    if any(prompt_sources):
        if not request.audio_prompt_text or not request.audio_prompt_text.strip():
            raise HTTPException(status_code=400, detail="audio_prompt_text is required when providing an audio prompt.")

    if request.audio_prompt_b64:
        try:
            audio_bytes = base64.b64decode(request.audio_prompt_b64)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Failed to decode audio_prompt_b64: {exc}") from exc
    elif request.audio_prompt_url:
        try:
            response = requests.get(str(request.audio_prompt_url), timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            audio_bytes = response.content
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Failed to download audio prompt: {exc}") from exc
    else:
        return None

    try:
        audio_array, sample_rate = sf.read(io.BytesIO(audio_bytes), dtype="float32", always_2d=False)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse audio prompt: {exc}") from exc

    if audio_array.ndim > 1:
        audio_array = np.mean(audio_array, axis=-1)

    temporary_file = tempfile.NamedTemporaryFile(prefix="dia_prompt_", suffix=".wav", delete=False)
    try:
        sf.write(temporary_file.name, audio_array, sample_rate)
        return temporary_file.name
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to persist audio prompt: {exc}") from exc
    finally:
        temporary_file.close()


def _run_generation(request: GenerateRequest) -> Tuple[GenerateResponse, bytes]:
    if _model is None or not _model_ready:
        raise HTTPException(status_code=503, detail="Model is still loading.")

    text = _validate_text(request)
    audio_prompt_path = _prepare_audio_prompt(request)
    cleanup_paths = [p for p in [audio_prompt_path] if p]

    if audio_prompt_path and request.audio_prompt_text:
        combined = f"{request.audio_prompt_text.strip()}\n{text}"
    elif request.audio_prompt_text and not audio_prompt_path:
        raise HTTPException(status_code=400, detail="audio_prompt_text provided without audio prompt data.")
    else:
        combined = text

    seed = request.seed if request.seed is not None else random.randint(0, 2**32 - 1)
    set_seed(seed)

    max_tokens = request.effective_max_tokens()
    cfg_scale = request.effective_cfg_scale()
    temperature = request.effective_temperature()
    top_p = request.effective_top_p()
    cfg_filter_top_k = request.effective_cfg_filter_top_k()
    speed_factor = request.effective_speed_factor()

    logger.info(
        "Generating audio (tokens=%d, cfg_scale=%.2f, temperature=%.2f, top_p=%.2f, top_k=%d, speed_factor=%.2f, seed=%d)",
        max_tokens,
        cfg_scale,
        temperature,
        top_p,
        cfg_filter_top_k,
        speed_factor,
        seed,
    )

    start_time = time.time()
    try:
        audio_output = _model.generate(
            combined,
            max_tokens=max_tokens,
            cfg_scale=cfg_scale,
            temperature=temperature,
            top_p=top_p,
            cfg_filter_top_k=cfg_filter_top_k,
            audio_prompt=audio_prompt_path,
            use_torch_compile=DEFAULT_USE_TORCH_COMPILE,
            verbose=request.verbose,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Generation failed: {exc}") from exc
    finally:
        for path in cleanup_paths:
            try:
                os.remove(path)
            except OSError:
                pass

    generation_seconds = time.time() - start_time

    waveform = np.asarray(audio_output, dtype=np.float32)
    if waveform.ndim > 1:
        waveform = waveform.squeeze()
    waveform = np.nan_to_num(waveform, nan=0.0, posinf=0.0, neginf=0.0)

    if speed_factor != 1.0:
        original_len = len(waveform)
        target_len = int(original_len / speed_factor)
        if target_len > 0 and target_len != original_len:
            waveform = np.interp(
                np.linspace(0, original_len - 1, target_len, dtype=np.float32),
                np.arange(original_len, dtype=np.float32),
                waveform,
            ).astype(np.float32)

    audio_buffer = io.BytesIO()
    sf.write(audio_buffer, waveform, DEFAULT_SAMPLE_RATE, format="WAV")
    audio_bytes = audio_buffer.getvalue()
    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

    duration_seconds = len(waveform) / DEFAULT_SAMPLE_RATE if DEFAULT_SAMPLE_RATE else 0.0

    return GenerateResponse(
        audio_base64=audio_base64,
        sample_rate=DEFAULT_SAMPLE_RATE,
        duration_seconds=duration_seconds,
        seed=seed,
        generation_seconds=generation_seconds,
    ), audio_bytes


@app.post("/generate", response_model=GenerateResponse)
async def generate_endpoint(request: GenerateRequest) -> GenerateResponse:
    async with _generation_lock:
        response, audio_bytes = await run_in_threadpool(_run_generation, request)

    if request.response_format == "wav":
        filename = f"dia-output-{response.seed}.wav"
        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Seed": str(response.seed),
            "X-Generation-Seconds": f"{response.generation_seconds:.6f}",
            "X-Duration-Seconds": f"{response.duration_seconds:.6f}",
            "X-Model-Id": response.model_id,
        }
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/wav", headers=headers)

    return response
