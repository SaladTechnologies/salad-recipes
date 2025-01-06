# This dockerfile includes env COMFY_HOME, WORKFLOW_DIR, MODEL_DIR, OUTPUT_DIR, INPUT_DIR
FROM saladtechnologies/comfyui:comfy0.3.10-api1.6.1-base

RUN mkdir -p $MODEL_DIR/text_encoders

# https://huggingface.co/Comfy-Org/HunyuanVideo_repackaged/tree/main/split_files/diffusion_models
COPY hunyuan_video_t2v_720p_bf16.safetensors ${MODEL_DIR}/diffusion_models/

# https://huggingface.co/Comfy-Org/HunyuanVideo_repackaged/tree/main/split_files/text_encoders
COPY clip_l.safetensors ${MODEL_DIR}/text_encoders/
COPY llava_llama3_fp8_scaled.safetensors ${MODEL_DIR}/text_encoders/

# https://huggingface.co/Comfy-Org/HunyuanVideo_repackaged/tree/main/split_files/vae
COPY hunyuan_video_vae_bf16.safetensors ${MODEL_DIR}/vae/

