# We're going to use this verified comfyui image as a base
ARG comfy_version=0.2.7
ARG api_version=1.6.0
FROM saladtechnologies/comfyui:comfy${comfy_version}-api${api_version}-base

ENV CHECKPOINT_DIR=${MODEL_DIR}/checkpoints
ENV CLIP_DIR=${MODEL_DIR}/clip
# https://huggingface.co/stabilityai/stable-diffusion-3.5-large
COPY sd3.5_medium.safetensors ${CHECKPOINT_DIR}/
COPY clip_g.safetensors ${CLIP_DIR}/
COPY clip_l.safetensors ${CLIP_DIR}/
COPY t5xxl_fp8_e4m3fn.safetensors ${CLIP_DIR}/

# The comfyui wrapper api supports a warmup mode, where it will run a provided workflow before starting the server.
COPY workflow.json .
ENV WARMUP_PROMPT_FILE=workflow.json

# We can add custom endpoints to the comfyui wrapper by poulating a workflows directory.
ENV WORKFLOW_DIR=/workflows
COPY workflows ${WORKFLOW_DIR}