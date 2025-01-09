# Use 'devel' to include the full cuda toolkit. required for some extensions and workflows,
# including Hunyuan video
ARG cuda_base=runtime
FROM pytorch/pytorch:2.5.0-cuda12.1-cudnn9-${cuda_base}
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
  curl \
  git \
  unzip \
  wget \
  && rm -rf /var/lib/apt/lists/*

# Install comfy-cli, which makes it easy to install custom nodes and other comfy specific functionality.
RUN pip install --upgrade pip
RUN pip install comfy-cli
WORKDIR /opt
ARG comfy_version=0.3.10
RUN git clone --depth 1 --branch v${comfy_version} https://github.com/comfyanonymous/ComfyUI.git
WORKDIR /opt/ComfyUI
RUN pip install torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/cu121
RUN pip install -r requirements.txt
ENV COMFY_HOME=/opt/ComfyUI
RUN comfy --skip-prompt tracking disable
RUN comfy --skip-prompt set-default ${COMFY_HOME}
ENV CMD="comfy --workspace ${COMFY_HOME} launch -- --listen *"
ENV BASE=""

# We also need to copy the comfyui-api binary into the image, since ComfyUI
# is fully asyncronous by default, and has no convenient way to retrieve 
# generated images. If you're adding a custom worker, you'll need to copy it in here.
# COPY comfyui-api .
ARG api_version=1.7.0
ADD https://github.com/SaladTechnologies/comfyui-api/releases/download/${api_version}/comfyui-api .
RUN chmod +x comfyui-api

# Set up some environment variables for the worker
ENV MODEL_DIR=${COMFY_HOME}/models
ENV OUTPUT_DIR=${COMFY_HOME}/output
ENV INPUT_DIR=${COMFY_HOME}/input
ENV WORKFLOW_DIR=/workflows

# Startup can take a little longer with larger models.
# This configures the worker binary's built-in health check.
ENV STARTUP_CHECK_MAX_TRIES=30

CMD ["./comfyui-api"]