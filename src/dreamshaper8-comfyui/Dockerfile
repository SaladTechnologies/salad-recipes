# We're going to use this verified comfyui image as a base
ARG comfy_version=0.3.35
ARG api_version=1.8.3
ARG torch_version=2.7.0
ARG cuda_version=12.6
FROM ghcr.io/saladtechnologies/comfyui-api:comfy${comfy_version}-api${api_version}-torch${torch_version}-cuda${cuda_version}-runtime

ENV CHECKPOINT_DIR=${MODEL_DIR}/checkpoints
# https://civitai.com/models/4384/dreamshaper
COPY dreamshaper_8.safetensors ${CHECKPOINT_DIR}/

# The comfyui wrapper api supports a warmup mode, where it will run a provided workflow before starting the server.
COPY workflow.json .
ENV WARMUP_PROMPT_FILE=workflow.json

# We can add custom endpoints to the comfyui wrapper by populating a workflows directory.
ENV WORKFLOW_DIR=/workflows
COPY workflows ${WORKFLOW_DIR}