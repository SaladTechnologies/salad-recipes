ARG comfy_version=0.3.27
ARG api_version=1.8.2
ARG torch_version=nightly
ARG cuda_version=12.8
FROM saladtechnologies/comfyui:comfy${comfy_version}-api${api_version}-torch${torch_version}-cuda${cuda_version}-flux1-dev-lora

# Download and extract the job queue worker
RUN wget https://github.com/SaladTechnologies/salad-cloud-job-queue-worker/releases/download/v0.4.1/salad-http-job-queue-worker_x86_64.tar.gz && \
  tar -xvf salad-http-job-queue-worker_x86_64.tar.gz && \
  rm salad-http-job-queue-worker_x86_64.tar.gz && \
  chmod +x salad-http-job-queue-worker

# Start the job queue worker in the background and the ComfyUI API in the foreground
CMD ["bash", "-c", "./salad-http-job-queue-worker & ./comfyui-api"]