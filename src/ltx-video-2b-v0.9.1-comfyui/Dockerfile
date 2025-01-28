# This dockerfile includes env COMFY_HOME, WORKFLOW_DIR, MODEL_DIR, OUTPUT_DIR, INPUT_DIR
ARG comfy_version=0.3.12
ARG api_version=1.8.2
FROM ghcr.io/saladtechnologies/comfyui-api:comfy${comfy_version}-api${api_version}-torch2.5.0-cuda12.1-devel

RUN apt-get update && apt-get install -y \
  libgl1 \
  libgl1-mesa-glx \
  libglib2.0-0 && \
  rm -rf /var/lib/apt/lists/*

# https://huggingface.co/Lightricks/LTX-Video/blob/main/ltx-video-2b-v0.9.1.safetensors
COPY ltx-video-2b-v0.9.1.safetensors $MODEL_DIR/checkpoints/

# https://huggingface.co/comfyanonymous/flux_text_encoders/blob/main/t5xxl_fp16.safetensors
COPY t5xxl_fp16.safetensors $MODEL_DIR/clip/

RUN comfy node registry-install comfyui-videohelpersuite

COPY workflow.json .
ENV WARMUP_PROMPT_FILE=workflow.json
