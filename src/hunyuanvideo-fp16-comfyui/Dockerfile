# This dockerfile includes env COMFY_HOME, WORKFLOW_DIR, MODEL_DIR, OUTPUT_DIR, INPUT_DIR
ARG comfy_version=0.3.12
ARG api_version=1.8.2
FROM ghcr.io/saladtechnologies/comfyui-api:comfy${comfy_version}-api${api_version}-torch2.5.0-cuda12.1-runtime

RUN apt-get update && apt-get install -y \
  libgl1 \
  libgl1-mesa-glx \
  libglib2.0-0 && \
  rm -rf /var/lib/apt/lists/*

RUN mkdir -p $MODEL_DIR/text_encoders

# https://huggingface.co/Comfy-Org/HunyuanVideo_repackaged/tree/main/split_files/diffusion_models
COPY hunyuan_video_t2v_720p_bf16.safetensors ${MODEL_DIR}/diffusion_models/

# https://huggingface.co/Comfy-Org/HunyuanVideo_repackaged/tree/main/split_files/text_encoders
COPY clip_l.safetensors ${MODEL_DIR}/text_encoders/
COPY llava_llama3_fp8_scaled.safetensors ${MODEL_DIR}/text_encoders/

# https://huggingface.co/Comfy-Org/HunyuanVideo_repackaged/tree/main/split_files/vae
COPY hunyuan_video_vae_bf16.safetensors ${MODEL_DIR}/vae/

RUN comfy node registry-install comfyui-videohelpersuite

COPY workflow.json .
ENV WARMUP_PROMPT_FILE=workflow.json