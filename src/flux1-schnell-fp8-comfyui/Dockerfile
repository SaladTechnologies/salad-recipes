# We're going to use this verified comfyui image as a base
ARG comfy_version=0.3.12
ARG api_version=1.8.0
FROM ghcr.io/saladtechnologies/comfyui-api:comfy${comfy_version}-api${api_version}-torch2.5.0-cuda12.1-runtime

ENV CHECKPOINT_DIR=${MODEL_DIR}/checkpoints
# https://huggingface.co/Comfy-Org/flux1-schnell
COPY flux1-schnell-fp8.safetensors ${CHECKPOINT_DIR}/

# The comfyui wrapper api supports a warmup mode, where it will run a provided workflow before starting the server.
COPY workflow.json .
ENV WARMUP_PROMPT_FILE=workflow.json

# We can add custom endpoints to the comfyui wrapper by poulating a workflows directory.
ENV WORKFLOW_DIR=/workflows
COPY workflows ${WORKFLOW_DIR}