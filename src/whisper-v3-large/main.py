import os
import asyncio
from typing import Optional
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import Response
from pydantic import BaseModel
import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
from transformers.utils import is_torch_sdpa_available
import yt_dlp
import aiohttp
import importlib.metadata
from packaging import version
import logging

app = FastAPI()

def is_flash_attn_2_available():
    try:
        flash_attn_version = importlib.metadata.version("flash_attn")
        if isinstance(flash_attn_version, str):
            return version.parse(flash_attn_version) >= version.parse("2.1.0")
        else:
            print(f"Unexpected version type: {type(flash_attn_version)}")
            return False
    except Exception as e:
        print(f"Error checking flash_attn version: {e}")
        return False

# Load the model and processor with Flash Attention 2
device = "cuda" if torch.cuda.is_available() else "cpu"
torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32

model_id = "openai/whisper-large-v3"


if is_flash_attn_2_available():
    attn_implementation = "flash_attention_2"
elif is_torch_sdpa_available():
    attn_implementation = "sdpa"
else:
    raise Exception("No compatible implementation of Self-Attention is available. Please install the 'flash_attn` package or upgrade to torch`.")


model = AutoModelForSpeechSeq2Seq.from_pretrained(
    model_id,
    torch_dtype=torch_dtype,
    low_cpu_mem_usage=True,
    attn_implementation=attn_implementation,
)
model.to(device)

processor = AutoProcessor.from_pretrained(model_id)

# Create the pipeline with chunked long-form transcription
asr_pipeline = pipeline(
    "automatic-speech-recognition",
    model=model,
    tokenizer=processor.tokenizer,
    feature_extractor=processor.feature_extractor,
    chunk_length_s=30,  # For chunked long-form transcription
    torch_dtype=torch_dtype,
    device=device,
)

# Request Models
class TranscriptionRequest(BaseModel):
    url: str
    timestamps: Optional[bool] = False
    translate: Optional[bool] = False



# Utility Functions
async def download_youtube(url: str) -> str:
    """
    Downloads audio from a URL or YouTube link and returns the file path.
    """
    filename = f"temp_{os.urandom(8).hex()}"

    ydl_opts = {
    'format': 'bestaudio/best',
    'outtmpl': filename,
    'postprocessors': [{
        'key': 'FFmpegExtractAudio',
        'preferredcodec': 'mp3',
        'preferredquality': '320',
        }],
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    return filename + ".mp3"

async def transcribe_audio(audio, options: dict) -> dict:
    """
    Transcribes the audio file with given options.
    """   
    result = asr_pipeline(audio, **options)
    if ".mp3" in audio:
        os.remove(audio)
    return result

# Endpoints
@app.post("/transcribe/url")
async def transcribe_url(request: TranscriptionRequest, response: Response):
    options = {
        "return_timestamps": request.timestamps,
        "generate_kwargs": {
            "task": "translate" if request.translate else "transcribe",
        },
    }
    if not request.url:
        response.status_code = 200
        return {"error": "url is required in /transcribe/url"}
    try:
        if "youtube.com" in request.url or "youtu.be" in request.url:
            audio_file = await download_youtube(request.url)
        else:
            audio_file = request.url
        transcription = await transcribe_audio(audio_file, options)
        return {"transcription": transcription}
    except Exception as e:
            logging.exception("Error during transcription")
            response.status_code = 500
            return {"error": str(e)}

@app.post("/transcribe/file")
async def transcribe_file(
    response: Response,
    file: UploadFile,
    timestamps: Optional[bool] = Form(False),
    translate: Optional[bool] = Form(False),
):
    options = {
        "return_timestamps": timestamps,
        "generate_kwargs": {
            "task": "translate" if translate else "transcribe",
        },
    }
    try:
        filename = f"temp_{os.urandom(8).hex()}_{file.filename}"
        with open(filename, 'wb') as f:
            content = await file.read()
            f.write(content)
        transcription = await transcribe_audio(filename, options)
        if os.path.exists(filename):
            os.remove(filename)
        return {"transcription": transcription}
    except Exception as e:
                logging.exception("Error during transcription")
                response.status_code = 500
                return {"error": str(e)}


@app.get("/health")
async def health_check():
    return {"status": "OK"}


@app.get("/ready")
async def readiness_check():
    return {"status": "OK"}
