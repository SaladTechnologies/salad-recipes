FROM nvidia/cuda:12.8.0-cudnn-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    VIRTUAL_ENV=/opt/kohya/venv
ENV PATH="${VIRTUAL_ENV}/bin:${PATH}"

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        git \
        git-lfs \
        curl \
        wget \
        ca-certificates \
        libgl1 \
        libglib2.0-0 \
        libsm6 \
        libxext6 \
        ffmpeg \
        build-essential \
        tini && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /opt/kohya

RUN python3 -m venv "${VIRTUAL_ENV}"

# Clone kohya sd-scripts repository at known-good commit.
RUN git clone https://github.com/kohya-ss/sd-scripts.git /opt/kohya/sd-scripts && \
    cd /opt/kohya/sd-scripts && \
    git checkout sd3 && \
    git reset --hard 80320d21fe2fc4604c8041849b9e1b6ae231ef63

COPY requirements.txt /tmp/requirements.txt

RUN pip install --upgrade pip && \
    sed -i '/^-e[[:space:]].*/d' /opt/kohya/sd-scripts/requirements.txt && \
    pip install torch==2.4.0 torchvision==0.19.0 --extra-index-url https://download.pytorch.org/whl/cu124 && \
    pip install -r /opt/kohya/sd-scripts/requirements.txt && \
    pip install -r /tmp/requirements.txt && \
    rm -rf /root/.cache/pip

# Install Kelpie worker binary
ARG KELPIE_VERSION=0.6.1
RUN set -eux; \
    curl -fsSL --retry 5 --retry-connrefused --connect-timeout 30 --http1.1 \
      -o /usr/local/bin/kelpie \
      "https://github.com/SaladTechnologies/kelpie/releases/download/${KELPIE_VERSION}/kelpie" && \
    chmod +x /usr/local/bin/kelpie && \
    ln -sf /usr/local/bin/kelpie /kelpie

COPY ensure_assets.py /opt/kohya/ensure_assets.py
COPY kohya_worker.py /opt/kohya/kohya_worker.py
COPY run_worker.sh /opt/kohya/run_worker.sh

RUN chmod +x /opt/kohya/run_worker.sh

# Placeholder directories for pretrained assets that can be populated at runtime.
RUN mkdir -p /opt/models/flux /opt/kohya/work

ENV HF_HUB_ENABLE_HF_TRANSFER=1 \
    TOKENIZERS_PARALLELISM=false \
    KOHYA_WORKSPACE_ROOT=/opt/kohya/work

ENTRYPOINT ["/usr/bin/tini", "--", "/opt/kohya/run_worker.sh"]
CMD []
