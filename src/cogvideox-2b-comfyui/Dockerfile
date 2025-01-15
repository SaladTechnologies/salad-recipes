# This dockerfile includes env COMFY_HOME, WORKFLOW_DIR, MODEL_DIR, OUTPUT_DIR, INPUT_DIR
ARG comfy_version=0.3.10
ARG api_version=1.7.2
FROM ghcr.io/saladtechnologies/comfyui-api:comfy${comfy_version}-api${api_version}-torch2.5.0-cuda12.1-runtime

RUN apt-get update && apt-get install -y \
  libgl1 \
  libgl1-mesa-glx \
  libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

COPY t5xxl_fp8_e4m3fn.safetensors ${MODEL_DIR}/clip/t5xxl_fp8_e4m3fn.safetensors
COPY CogVideo2B ${MODEL_DIR}/CogVideo/CogVideo2B

RUN comfy node registry-install comfyui-videohelpersuite
RUN comfy node registry-install comfyui-cogvideoxwrapper

COPY workflow.json .
ENV WARMUP_PROMPT_FILE=workflow.json