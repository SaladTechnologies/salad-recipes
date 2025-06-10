# We're going to use this verified comfyui image as a base
ARG comfy_version=0.3.40
ARG torch_version=2.7.1
ARG cuda_version=12.6
FROM ghcr.io/saladtechnologies/comfyui-api:comfy${comfy_version}-torch${torch_version}-cuda${cuda_version}-runtime

ENV CHECKPOINT_DIR=${MODEL_DIR}/checkpoints
ENV CLIP_DIR=${MODEL_DIR}/clip
# https://huggingface.co/stabilityai/stable-diffusion-3.5-medium
COPY sd3.5_medium.safetensors ${CHECKPOINT_DIR}/

# https://huggingface.co/Comfy-Org/stable-diffusion-3.5-fp8/blob/main/text_encoders/clip_g.safetensors
COPY clip_g.safetensors ${CLIP_DIR}/

# https://huggingface.co/Comfy-Org/stable-diffusion-3.5-fp8/blob/main/text_encoders/clip_l.safetensors
COPY clip_l.safetensors ${CLIP_DIR}/

# https://huggingface.co/Comfy-Org/stable-diffusion-3.5-fp8/blob/main/text_encoders/t5xxl_fp8_e4m3fn_scaled.safetensors
COPY t5xxl_fp8_e4m3fn.safetensors ${CLIP_DIR}/

# The comfyui wrapper api supports a warmup mode, where it will run a provided workflow before starting the server.
COPY workflow.json .
ENV WARMUP_PROMPT_FILE=workflow.json

# We can add custom endpoints to the comfyui wrapper by populating a workflows directory.
ENV WORKFLOW_DIR=/workflows
COPY workflows ${WORKFLOW_DIR}

ENV STARTUP_CHECK_MAX_TRIES=30

# Download the comfyui-api binary, and make it executable
ARG api_version=1.9.0
ADD https://github.com/SaladTechnologies/comfyui-api/releases/download/${api_version}/comfyui-api .
RUN chmod +x comfyui-api

# Set CMD to launch the comfyui-api binary. The comfyui-api binary will launch ComfyUI as a child process.
CMD ["./comfyui-api"]