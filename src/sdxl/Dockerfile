ARG PYVERSION=py39
FROM baseten/truss-server-base:3.9-gpu-v0.4.9

ENV PYTHON_EXECUTABLE python3


RUN grep -w 'ID=debian\|ID_LIKE=debian' /etc/os-release || { echo "ERROR: Supplied base image is not a debian image"; exit 1; }
RUN $PYTHON_EXECUTABLE -c "import sys; sys.exit(0) if sys.version_info.major == 3 and sys.version_info.minor >=8 and sys.version_info.minor <=11 else sys.exit(1)" \
    || { echo "ERROR: Supplied base image does not have 3.8 <= python <= 3.11"; exit 1; }


RUN pip install --upgrade pip --no-cache-dir

# If user base image is supplied in config, apply build commands from truss base image







RUN apt-get update
RUN apt-get install -y socat
RUN apt-get install -y ffmpeg
RUN apt-get install -y libxext6
RUN apt-get install -y libsm6










COPY ./requirements.txt requirements.txt
RUN pip install -r requirements.txt --no-cache-dir




COPY ./cache_warmer.py /cache_warmer.py
        
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py config.json madebyollin/sdxl-vae-fp16-fix 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py diffusion_pytorch_model.safetensors madebyollin/sdxl-vae-fp16-fix 
            
        
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py model_index.json stabilityai/stable-diffusion-xl-base-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py scheduler/scheduler_config.json stabilityai/stable-diffusion-xl-base-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py sd_xl_base_1.0.safetensors stabilityai/stable-diffusion-xl-base-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py text_encoder/config.json stabilityai/stable-diffusion-xl-base-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py text_encoder/model.fp16.safetensors stabilityai/stable-diffusion-xl-base-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py text_encoder_2/config.json stabilityai/stable-diffusion-xl-base-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py text_encoder_2/model.fp16.safetensors stabilityai/stable-diffusion-xl-base-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py tokenizer/special_tokens_map.json stabilityai/stable-diffusion-xl-base-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py tokenizer/tokenizer_config.json stabilityai/stable-diffusion-xl-base-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py tokenizer/vocab.json stabilityai/stable-diffusion-xl-base-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py tokenizer_2/special_tokens_map.json stabilityai/stable-diffusion-xl-base-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py tokenizer_2/tokenizer_config.json stabilityai/stable-diffusion-xl-base-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py tokenizer_2/vocab.json stabilityai/stable-diffusion-xl-base-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py unet/config.json stabilityai/stable-diffusion-xl-base-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py unet/diffusion_pytorch_model.fp16.safetensors stabilityai/stable-diffusion-xl-base-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py vae/config.json stabilityai/stable-diffusion-xl-base-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py vae/diffusion_pytorch_model.fp16.safetensors stabilityai/stable-diffusion-xl-base-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py vae_1_0/config.json stabilityai/stable-diffusion-xl-base-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py vae_1_0/diffusion_pytorch_model.fp16.safetensors stabilityai/stable-diffusion-xl-base-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py vae_decoder/config.json stabilityai/stable-diffusion-xl-base-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py vae_encoder/config.json stabilityai/stable-diffusion-xl-base-1.0 
            
        
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py model_index.json stabilityai/stable-diffusion-xl-refiner-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py scheduler/scheduler_config.json stabilityai/stable-diffusion-xl-refiner-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py sd_xl_refiner_1.0.safetensors stabilityai/stable-diffusion-xl-refiner-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py text_encoder_2/config.json stabilityai/stable-diffusion-xl-refiner-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py text_encoder_2/model.fp16.safetensors stabilityai/stable-diffusion-xl-refiner-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py tokenizer_2/special_tokens_map.json stabilityai/stable-diffusion-xl-refiner-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py tokenizer_2/tokenizer_config.json stabilityai/stable-diffusion-xl-refiner-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py tokenizer_2/vocab.json stabilityai/stable-diffusion-xl-refiner-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py unet/config.json stabilityai/stable-diffusion-xl-refiner-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py unet/diffusion_pytorch_model.fp16.safetensors stabilityai/stable-diffusion-xl-refiner-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py vae/config.json stabilityai/stable-diffusion-xl-refiner-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py vae/diffusion_pytorch_model.fp16.safetensors stabilityai/stable-diffusion-xl-refiner-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py vae_1_0/config.json stabilityai/stable-diffusion-xl-refiner-1.0 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py vae_1_0/diffusion_pytorch_model.fp16.safetensors stabilityai/stable-diffusion-xl-refiner-1.0 
            
        



ENV APP_HOME /app
WORKDIR $APP_HOME



# Copy data before code for better caching

COPY ./server /app
COPY ./start.sh /app
COPY ./model /app/model
COPY ./config.yaml /app/config.yaml








ENV INFERENCE_SERVER_PORT 8080
ENV SERVER_START_CMD="python3 /app/inference_server.py"
CMD bash start.sh

## ENTRYPOINT ["python3", "/app/inference_server.py"]]
