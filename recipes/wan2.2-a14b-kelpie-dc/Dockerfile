FROM pytorch/pytorch:2.7.0-cuda12.8-cudnn9-devel

ENV DEBIAN_FRONTEND=noninteractive
ENV CUDA_HOME=/usr/local/cuda
ENV PATH=${CUDA_HOME}/bin:${PATH}

# Perf / stability
ENV PYTHONUNBUFFERED=1 \
    HF_HUB_DISABLE_TELEMETRY=1 \
    HF_HUB_ENABLE_HF_TRANSFER=1 \
    PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    TF_ENABLE_ONEDNN_OPTS=1 \
    NVIDIA_TF32_OVERRIDE=1

# ---------- System deps ----------
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
        git ffmpeg tini ca-certificates curl tmux && \
    rm -rf /var/lib/apt/lists/*

# ---------- Python base deps ----------
RUN pip install --upgrade --no-cache-dir pip wheel packaging setuptools


WORKDIR /opt

# --- Core libs (diffusers main, DFloat11, hf_transfer, etc.) ---
RUN pip install --no-cache-dir \
    "git+https://github.com/huggingface/diffusers" \
    transformers accelerate safetensors pillow opencv-python \
    "dfloat11[cuda12]" \
    hf_transfer \
    "huggingface_hub[cli]" \
    imageio[ffmpeg] av moviepy \
    ftfy timm
    
COPY ./requirements.txt /opt/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY t2v.py /opt/t2v.py

# Kelpie sync points
RUN mkdir -p /opt/checkpoints /opt/outputs /opt/assets

# Install missing libraries: 
RUN pip install librosa decord

# --- Kelpie (download via curl) ---
ARG KELPIE_VERSION=0.6.1
RUN set -eux; \
    curl -fsSL --retry 5 --retry-connrefused --connect-timeout 30 --http1.1 \
        -o /usr/local/bin/kelpie \
        https://github.com/SaladTechnologies/kelpie/releases/download/${KELPIE_VERSION}/kelpie && \
    chmod +x /usr/local/bin/kelpie && \
    ln -sf /usr/local/bin/kelpie /kelpie

COPY entrypoint.sh /opt/entrypoint.sh
RUN chmod +x /opt/entrypoint.sh

ENTRYPOINT ["/usr/bin/tini", "--", "/opt/entrypoint.sh"]
CMD []

