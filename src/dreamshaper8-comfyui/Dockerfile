# We're going to use this verified comfyui image as a base
ARG comfy_version=0.3.10
ARG api_version=1.7.0
FROM saladtechnologies/comfyui:comfy${comfy_version}-api${api_version}-base

ENV CHECKPOINT_DIR=${MODEL_DIR}/checkpoints
# https://civitai.com/models/4384/dreamshaper
COPY dreamshaper_8.safetensors ${CHECKPOINT_DIR}/

# The comfyui wrapper api supports a warmup mode, where it will run a provided workflow before starting the server.
COPY workflow.json .
ENV WARMUP_PROMPT_FILE=workflow.json

# We can add custom endpoints to the comfyui wrapper by poulating a workflows directory.
ENV WORKFLOW_DIR=/workflows
COPY workflows ${WORKFLOW_DIR}