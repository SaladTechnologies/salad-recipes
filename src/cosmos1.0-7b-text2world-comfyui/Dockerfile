# This dockerfile includes env COMFY_HOME, WORKFLOW_DIR, MODEL_DIR, OUTPUT_DIR, INPUT_DIR
ARG comfy_version=0.3.12
ARG api_version=1.8.2
FROM ghcr.io/saladtechnologies/comfyui-api:comfy${comfy_version}-api${api_version}-torch2.5.0-cuda12.1-runtime

RUN apt-get update && apt-get install -y \
  libgl1 \
  libgl1-mesa-glx \
  libglib2.0-0 && \
  rm -rf /var/lib/apt/lists/*

# https://huggingface.co/comfyanonymous/cosmos_1.0_text_encoder_and_VAE_ComfyUI/tree/main/text_encoders
COPY oldt5_xxl_fp8_e4m3fn_scaled.safetensors ${MODEL_DIR}/text_encoders/

# https://huggingface.co/comfyanonymous/cosmos_1.0_text_encoder_and_VAE_ComfyUI/blob/main/vae/cosmos_cv8x8x8_1.0.safetensors
COPY cosmos_cv8x8x8_1.0.safetensors ${MODEL_DIR}/vae/

# https://huggingface.co/mcmonkey/cosmos-1.0/blob/main/Cosmos-1_0-Diffusion-7B-Text2World.safetensors
COPY Cosmos-1_0-Diffusion-7B-Text2World.safetensors ${MODEL_DIR}/diffusion_models/

# Not required, but nice to have for all video stuff.
RUN comfy node registry-install comfyui-videohelpersuite

# The comfyui wrapper api supports a warmup mode, where it will run a provided workflow before starting the server.
COPY workflow.json .
ENV WARMUP_PROMPT_FILE=workflow.json