# This dockerfile includes env COMFY_HOME, WORKFLOW_DIR, MODEL_DIR, OUTPUT_DIR, INPUT_DIR
ARG comfy_version=0.3.12
ARG api_version=1.8.0
FROM ghcr.io/saladtechnologies/comfyui-api:comfy${comfy_version}-api${api_version}-torch2.5.0-cuda12.1-runtime

RUN apt-get update && apt-get install -y \
  libgl1 \
  libgl1-mesa-glx \
  libglib2.0-0 && \
  rm -rf /var/lib/apt/lists/*

RUN comfy node registry-install comfyui-videohelpersuite
RUN comfy node registry-install comfyui-animatediff-evolved
RUN comfy node registry-install efficiency-nodes-comfyui
RUN comfy node registry-install comfyui-advanced-controlnet

RUN mkdir -p $MODEL_DIR/animatediff_models

# https://huggingface.co/wangfuyun/AnimateLCM/resolve/b78bbce/AnimateLCM_sd15_t2v.ckpt
COPY AnimateLCM_sd15_t2v.ckpt ${MODEL_DIR}/animatediff_models/

# https://civitai.com/models/4384/dreamshaper
COPY dreamshaper_8.safetensors ${MODEL_DIR}/checkpoints/

# https://huggingface.co/lllyasviel/control_v11p_sd15_openpose/resolve/main/diffusion_pytorch_model.fp16.safetensors
COPY openpose-sd1.5-1.1.safetensors ${MODEL_DIR}/controlnet/

# https://civitai.com/models/193225?modelVersionId=235847
COPY jump_V2.safetensors ${MODEL_DIR}/loras/

# https://huggingface.co/stabilityai/sd-vae-ft-mse-original/blob/main/vae-ft-mse-840000-ema-pruned.ckpt
COPY vae-ft-mse-840000-ema-pruned.ckpt ${MODEL_DIR}/vae/

# https://civitai.com/models/56307?modelVersionId=63973
COPY poses/ $INPUT_DIR/

# The comfyui wrapper api supports a warmup mode, where it will run a provided workflow before starting the server.
COPY workflow.json .
ENV WARMUP_PROMPT_FILE=workflow.json