FROM ghcr.io/saladtechnologies/comfyui-api:comfy0.3.27-api1.8.2-torch2.6.0-cuda12.4-runtime

COPY wan2.1_i2v_720p_14B_fp8_scaled.safetensors $MODEL_DIR/diffusion_models/
COPY umt5_xxl_fp8_e4m3fn_scaled.safetensors $MODEL_DIR/text_encoders/
COPY wan_2.1_vae.safetensors $MODEL_DIR/vae/
COPY clip_vision_h.safetensors $MODEL_DIR/clip_vision/

# Download and extract the job queue worker
RUN wget https://github.com/SaladTechnologies/salad-cloud-job-queue-worker/releases/download/v0.4.1/salad-http-job-queue-worker_x86_64.tar.gz && \
  tar -xvf salad-http-job-queue-worker_x86_64.tar.gz && \
  rm salad-http-job-queue-worker_x86_64.tar.gz && \
  chmod +x salad-http-job-queue-worker

# Start the job queue worker in the background and the ComfyUI API in the foreground
CMD ["bash", "-c", "./salad-http-job-queue-worker & ./comfyui-api"]