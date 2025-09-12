FROM pytorch/pytorch:2.7.0-cuda12.8-cudnn9-devel

ENV DEBIAN_FRONTEND=noninteractive
ENV CUDA_HOME=/usr/local/cuda
ENV PATH=${CUDA_HOME}/bin:${PATH}

# Perf / stability
ENV PYTHONUNBUFFERED=1 \
    HF_HUB_DISABLE_TELEMETRY=1 \
    HF_HUB_ENABLE_HF_TRANSFER=1 \
    TORCH_CUDA_ALLOC_CONF=expandable_segments:True \
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

# ---------- Wan2.2 ----------
WORKDIR /opt
RUN git clone https://github.com/Wan-Video/Wan2.2.git
WORKDIR /opt/Wan2.2

RUN pip install --no-cache-dir -r requirements.txt

RUN pip install --no-cache-dir flash-attn --no-build-isolation || true

RUN pip install --no-cache-dir \
    huggingface_hub[cli] \
    hf_transfer \
    imageio[ffmpeg] av moviepy \
    azure-storage-blob azure-identity \
    ftfy timm

COPY wan_worker.py /opt/wan_worker.py

# Kelpie sync points
RUN mkdir -p /opt/checkpoints /opt/outputs /opt/assets

# Install missing libraries: 
RUN pip install librosa decord

# --- Kelpie (download via curl) ---
ARG KELPIE_VERSION=0.6.0
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

