# We're going to use this verified comfyui image as a base
ARG comfy_version=0.3.12
ARG api_version=1.8.0
FROM ghcr.io/saladtechnologies/comfyui-api:comfy${comfy_version}-api${api_version}-torch2.5.0-cuda12.1-runtime

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

# We can add custom endpoints to the comfyui wrapper by poulating a workflows directory.
ENV WORKFLOW_DIR=/workflows
COPY workflows ${WORKFLOW_DIR}