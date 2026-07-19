# ---------------------------------------------------------------------------
# Unsloth Studio - SaladCloud Recipe
# ---------------------------------------------------------------------------
# Self-contained image: Unsloth Studio (+ PyTorch/CUDA) is installed AT BUILD
# time. On SaladCloud the container starts Studio and publishes a URL. Since
# SaladCloud always restarts this same image, nothing needs to be reinstalled
# after a node reallocation.
#
# GPU required: NVIDIA Blackwell/Ada (e.g. RTX 5090/4090). The PyTorch wheels
# bundle CUDA, so a plain Ubuntu 24.04 base is enough; SaladCloud provides the
# NVIDIA driver at runtime.
# ---------------------------------------------------------------------------
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# System dependencies (cmake + libcurl: Unsloth's GGUF engine; expect:
# non-interactive password entry; tmux/git: convenience + install).
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl git ca-certificates build-essential cmake libcurl4-openssl-dev \
        python3 python3-venv python3-pip expect tmux \
    && rm -rf /var/lib/apt/lists/*

# --- Install Unsloth Studio at build time (bake CUDA torch + unsloth) --------
# PROBLEM: the build runs on a GPU-less runner -> install.sh detects "no GPU"
# and installs **CPU** PyTorch (torch.cuda unavailable at runtime = "no GPU
# backend available" error). SOLUTION: fake a GPU with a stub nvidia-smi during
# the install so install.sh picks the **CUDA** stack (torch cu130 + GPU
# torchao). The real NVIDIA driver is provided by SaladCloud at runtime.
# CAUTION: install.sh picks the PyTorch index (cu126/cu128/cu130) by reading
# the "CUDA Version: X.Y" line of nvidia-smi output; without it, it falls back
# to **cu126**, whose wheels DO NOT have Blackwell sm_120 kernels -> on an
# RTX 5090 model loading fails ("no kernel image is available for execution on
# the device"). The stub nvidia-smi MUST therefore report "CUDA Version: 13.0"
# to get cu130 (sm_89 4090 AND sm_120 5090).
ENV UNSLOTH_SKIP_AUTOSTART=1
RUN printf '#!/bin/sh\necho "GPU 0: NVIDIA GeForce RTX 4090 (UUID: GPU-00000000-0000-0000-0000-000000000000)"\necho "CUDA Version: 13.0"\nexit 0\n' \
        > /usr/local/bin/nvidia-smi \
    && chmod +x /usr/local/bin/nvidia-smi \
    && curl -fsSL https://unsloth.ai/install.sh | sh \
    && rm -f /usr/local/bin/nvidia-smi

# Belt and suspenders: if torch is CPU-only OR CUDA < 12.8 (no Blackwell sm_120
# kernels -> crash at model load on RTX 5090), force the cu130 variant (same
# version). The SaladCloud driver is CUDA 13.x.
RUN set -e; \
    PIP=/root/.unsloth/studio/unsloth_studio/bin/pip; \
    PY=/root/.unsloth/studio/unsloth_studio/bin/python; \
    if $PY -c "import torch,sys; v=torch.version.cuda; sys.exit(0 if v and tuple(map(int,v.split('.')[:2]))>=(12,8) else 1)"; then \
        echo "torch CUDA OK: $($PY -c 'import torch;print(torch.__version__)')"; \
    else \
        TV=$($PY -c "import torch;print(torch.__version__.split('+')[0])"); \
        echo "torch is CPU-only or CUDA < 12.8 ($TV) -> reinstalling cu130"; \
        $PIP install --no-cache-dir --force-reinstall "torch==$TV" \
            --index-url https://download.pytorch.org/whl/cu130; \
    fi; \
    $PY -c "import torch; v=torch.version.cuda; assert v and tuple(map(int,v.split('.')[:2]))>=(12,8), f'torch {torch.__version__} lacks Blackwell sm_120 support'"

# --- Inference fix: remove flash_attn -> Unsloth falls back to sdpa ----------
# Otherwise some models crash (Nemotron, Gemma-3...):
#   "static cache is not compatible with attn_implementation==flash_attention_2"
RUN /root/.unsloth/studio/unsloth_studio/bin/pip uninstall -y flash_attn flash-attn || true

ENV PATH="/root/.unsloth/studio/unsloth_studio/bin:${PATH}"

# Hugging Face cache on a stable path (mountable as a Salad persistent volume)
ENV HF_HOME=/root/.cache/huggingface

# Defaults suited to the SaladCloud Container Gateway (stable URL, no
# Cloudflare): Studio listens on '::' (dual-stack, port 8080) and the Gateway
# exposes that port publicly.
ENV EXPOSE_MODE=gateway
ENV STUDIO_PORT=8080

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Studio web port (used when exposing via the SaladCloud Container Gateway)
EXPOSE 8080

# tini as PID 1: Studio must NEVER run as PID 1. Its child-spawn preexec hook
# (studio/backend/utils/process_lifetime.py) kills every spawned llama-server
# when getppid()==1 ("parent already died") -> with Studio as PID 1 every model
# load fails instantly ("llama-server failed to start", exit 1, empty log).
# Behind tini, Studio gets a pid > 1 and the guard stays inert.
# (Dedicated layer at the end of the build so it does not invalidate the cache
# of the big torch/unsloth install layers above.)
RUN apt-get update && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*
ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
