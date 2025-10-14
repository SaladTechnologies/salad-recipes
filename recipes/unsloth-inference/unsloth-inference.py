# app.py
import json
import os
from queue import Queue
from threading import Thread

from unsloth import FastLanguageModel
import torch
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from transformers import TextStreamer

MODEL_ID = os.getenv("MODEL_ID", "unsloth/Meta-Llama-3.1-8B-Instruct-bnb-4bit")
MAX_SEQ = int(os.getenv("MAX_SEQ_LEN", "8192"))
DTYPE = os.getenv("DTYPE", "bfloat16")  # or "float16"
LOAD_4BIT = os.getenv("LOAD_IN_4BIT", "true").lower() == "true"
STREAM_STDOUT = os.getenv("STREAM_STDOUT", "true").lower() == "true"
MAX_NEW_CAP = int(os.getenv("MAX_NEW_CAP", "4096"))

# Map string dtype to torch dtype
_DTYPE_MAP = {"bfloat16": torch.bfloat16, "bf16": torch.bfloat16,
              "float16": torch.float16, "fp16": torch.float16}
_torch_dtype = _DTYPE_MAP.get(DTYPE.lower(), torch.bfloat16)

model, tok = FastLanguageModel.from_pretrained(
    model_name=MODEL_ID, max_seq_length=MAX_SEQ, dtype=DTYPE, load_in_4bit=LOAD_4BIT
)
FastLanguageModel.for_inference(model)

app = FastAPI()


class ChatRequest(BaseModel):
    prompt: str
    max_new_tokens: int = 256
    stream: bool = False


class QueueStreamer(TextStreamer):
    def __init__(self, tokenizer, queue: Queue, mirror_stdout: bool = False):
        super().__init__(tokenizer, skip_prompt=True, skip_special_tokens=True)
        self.queue = queue
        self.mirror_stdout = mirror_stdout

    def on_text(self, text: str, **kwargs):  # type: ignore[override]
        if text:
            self.queue.put({"type": "token", "text": text})
        if self.mirror_stdout:
            super().on_text(text, **kwargs)

@app.get("/health")
def health(): return {"ok": True}

@app.post("/v1/generate")
def generate(req: ChatRequest):
    if not req.prompt.strip():
        return {"error": "empty prompt"}
    max_new = max(1, min(req.max_new_tokens, MAX_NEW_CAP))
    inputs = tok(req.prompt, return_tensors="pt").to(model.device)

    if req.stream:
        token_queue: Queue = Queue()
        streamer = QueueStreamer(tok, token_queue, mirror_stdout=STREAM_STDOUT)

        def produce():
            try:
                with torch.inference_mode():
                    output_ids = model.generate(**inputs, streamer=streamer, max_new_tokens=max_new)
                tail = output_ids[0][inputs["input_ids"].shape[1]:]
                text = tok.decode(tail, skip_special_tokens=True)
                token_queue.put({
                    "type": "complete",
                    "status": "completed",
                    "text": text,
                    "generated_tokens": int(tail.shape[0])
                })
            except Exception as exc:  # pragma: no cover - defensive path
                token_queue.put({
                    "type": "error",
                    "status": "error",
                    "message": str(exc)
                })
            finally:
                token_queue.put(None)

        Thread(target=produce, daemon=True).start()

        def event_stream():
            while True:
                item = token_queue.get()
                if item is None:
                    break
                yield f"data: {json.dumps(item)}\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    streamer = TextStreamer(tok, skip_prompt=True, skip_special_tokens=True) if STREAM_STDOUT else None
    with torch.inference_mode():
        output_ids = model.generate(**inputs, streamer=streamer, max_new_tokens=max_new)
    tail = output_ids[0][inputs["input_ids"].shape[1]:]
    text = tok.decode(tail, skip_special_tokens=True)
    return {
        "status": "completed",
        "text": text,
        "generated_tokens": int(tail.shape[0])
    }
