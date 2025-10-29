FROM pytorch/pytorch:2.1.2-cuda12.1-cudnn8-runtime

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_NO_CACHE_DIR=1 \
    PIP_EXTRA_INDEX_URL=https://download.pytorch.org/whl/cu126 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/var/cache/huggingface \
    TRANSFORMERS_CACHE=/var/cache/huggingface \
    HUGGINGFACE_HUB_CACHE=/var/cache/huggingface

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        ffmpeg \
        git \
        libsndfile1 \
        wget && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip

RUN pip install \
        torch==2.6.0 \
        torchaudio==2.6.0

RUN pip install \
        fastapi==0.115.4 \
        "uvicorn[standard]==0.32.0" \
        requests==2.32.3 \
        soundfile==0.13.1 \
        numpy==2.2.4 \
        hf_transfer==0.1.6 \
        "huggingface_hub[cli]==0.35.3" \
        git+https://github.com/nari-labs/dia.git

ENV HF_HUB_DISABLE_TELEMETRY=1 \
    HF_HUB_ENABLE_HF_TRANSFER=1 \
    HF_HOME=/var/cache/huggingface \
    TRANSFORMERS_CACHE=/var/cache/huggingface \
    HUGGINGFACE_HUB_CACHE=/var/cache/huggingface \
    DIA_MODEL_ID="nari-labs/Dia-1.6B-0626" \
    DIA_MODEL_PATH="/opt/models/dia-1.6b"

RUN mkdir -p "${DIA_MODEL_PATH}" && \
    huggingface-cli download "${DIA_MODEL_ID}" \
        --include "config.json" \
        --include "audio_tokenizer_config.json" \
        --include "generation_config.json" \
        --include "preprocessor_config.json" \
        --include "special_tokens_map.json" \
        --include "tokenizer_config.json" \
        --include "dia-v1.pth" \
        --local-dir "${DIA_MODEL_PATH}" \
        --local-dir-use-symlinks False \
        --resume-download && \
    rm -rf "${DIA_MODEL_PATH}/.cache"

RUN useradd --create-home --uid 1000 appuser && \
    mkdir -p /app /var/cache/huggingface && \
    chown -R appuser:appuser /app /var/cache/huggingface "${DIA_MODEL_PATH}"

WORKDIR /app

COPY server.py /app/server.py

USER appuser

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "::", "--port", "8000", "--workers", "2", "--log-level", "info"]
