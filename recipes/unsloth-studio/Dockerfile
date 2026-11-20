FROM ubuntu:24.04@sha256:9c7f200c07e3d4a03e7249d2c16bf66a51120fb876aa2242cf31451412543289

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl git ca-certificates build-essential cmake libcurl4-openssl-dev \
        python3 python3-venv python3-pip expect tmux tini \
    && rm -rf /var/lib/apt/lists/*

# Upstream selects the torch wheel index with nvidia-smi. Advertise the
# fleet's CUDA floor during the GPU-less build; never ship the probe stub.
ARG INSTALLER_REV=a8ff8673df640710e58fabfb226df565d9751afe
ENV UNSLOTH_SKIP_AUTOSTART=1 \
    UNSLOTH_STUDIO_HOME=/root/.unsloth/studio
RUN set -eu; \
    printf '#!/bin/sh\necho "GPU 0: NVIDIA GeForce RTX 5090 (UUID: GPU-00000000-0000-0000-0000-000000000000)"\necho "CUDA Version: 12.8"\n' >/usr/local/bin/nvidia-smi; \
    chmod +x /usr/local/bin/nvidia-smi; \
    printf '%s\n' 'unsloth==2026.7.3' 'unsloth-zoo==2026.7.3' 'torch==2.10.0' >/tmp/constraints.txt; \
    curl -fsSL --retry 3 "https://raw.githubusercontent.com/unslothai/unsloth/${INSTALLER_REV}/install.sh" -o /tmp/install.sh; \
    UV_CONSTRAINT=/tmp/constraints.txt PIP_CONSTRAINT=/tmp/constraints.txt sh /tmp/install.sh; \
    rm /usr/local/bin/nvidia-smi /tmp/install.sh /tmp/constraints.txt

ENV PATH="/root/.unsloth/studio/unsloth_studio/bin:${PATH}"
RUN python -c 'import torch; from importlib.metadata import version; assert version("unsloth") == "2026.7.3"; assert torch.__version__ == "2.10.0+cu128" and torch.version.cuda == "12.8", torch.__version__; assert "sm_120" in torch._C._cuda_getArchFlags().split()' \
    && python -m pip uninstall -y flash-attn

ENV HF_HOME=/root/.cache/huggingface \
    EXPOSE_MODE=gateway \
    STUDIO_PORT=8080
COPY --chmod=755 entrypoint.sh /entrypoint.sh
EXPOSE 8080
# Keep Studio off PID 1 so its parent-death guard permits GGUF child processes.
ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
