# We're going to use this verified comfyui image as a base
ARG comfy_version=0.2.2
ARG api_version=1.4.2
FROM saladtechnologies/comfyui:comfy${comfy_version}-api${api_version}-base

ENV CHECKPOINT_DIR=${MODEL_DIR}/checkpoints
# https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0
COPY sd_xl_base_1.0.safetensors ${CHECKPOINT_DIR}/

# https://huggingface.co/stabilityai/stable-diffusion-xl-refiner-1.0
COPY sd_xl_refiner_1.0.safetensors ${CHECKPOINT_DIR}/

# The comfyui wrapper api supports a warmup mode, where it will run a provided workflow before starting the server.
COPY workflow.json .
ENV WARMUP_PROMPT_FILE=workflow.json

# We can add custom endpoints to the comfyui wrapper by poulating a workflows directory.
ENV WORKFLOW_DIR=/workflows
COPY workflows ${WORKFLOW_DIR}
