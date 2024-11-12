ARG comfy_version=0.2.7
FROM ghcr.io/ai-dock/comfyui:v2-cuda-12.1.1-base-22.04-v${comfy_version}

# Disable the authentication and cloudflare tunnels provided by the base image
ENV WEB_ENABLE_AUTH=false
ENV CF_QUICK_TUNNELS=false

# Disable a bunch of services we don't need for the worker
RUN rm /etc/supervisor/supervisord/conf.d/jupyter.conf
RUN rm /etc/supervisor/supervisord/conf.d/storagemonitor.conf
RUN rm /etc/supervisor/supervisord/conf.d/comfyui_api_wrapper.conf
RUN rm /etc/supervisor/supervisord/conf.d/serviceportal.conf
RUN rm /etc/supervisor/supervisord/conf.d/sshd.conf
RUN rm /etc/supervisor/supervisord/conf.d/syncthing.conf

# We also need to copy the comfyui-api binary into the image, since ComfyUI
# is fully asyncronous by default, and has no convenient way to retrieve 
# generated images. If you're adding a custom worker, you'll need to copy it in here.
# COPY comfyui-api .
ARG api_version=1.6.0
ADD https://github.com/SaladTechnologies/comfyui-api/releases/download/${api_version}/comfyui-api .
RUN chmod +x comfyui-api

# Set up some environment variables for the worker
ENV COMFY_HOME=/opt/ComfyUI
ENV MODEL_DIR=${COMFY_HOME}/models
ENV OUTPUT_DIR=${COMFY_HOME}/output
ENV INPUT_DIR=${COMFY_HOME}/input

# Startup can take a little longer with larger models.
# This configures the worker binary's built-in health check.
ENV STARTUP_CHECK_MAX_TRIES=30

# Install comfy-cli, which makes it easy to install custom nodes and other comfy specific functionality.
RUN pip install --upgrade pip
RUN pip install comfy-cli

# Disable tracking and set the default directory to /opt/ComfyUI/
RUN echo "N" | comfy tracking disable
RUN comfy set-default ${COMFY_HOME}

CMD ["./comfyui-api"]