FROM pytorch/pytorch:2.7.1-cuda12.8-cudnn9-runtime

# Install all OS dependencies in one RUN, minimize layers and apt cache
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        build-essential \
        gcc && \
    rm -rf /var/lib/apt/lists/*

# Install Python packages in a single RUN
RUN pip install --no-cache-dir -U pruna litserve
RUN  pip install \
    https://download.pytorch.org/whl/cu128/torch-2.7.0%2Bcu128-cp311-cp311-manylinux_2_28_x86_64.whl#sha256=c4bbc0b4be60319ba1cefc90be9557b317f0b3c261eeceb96ca6e0343eec56bf

RUN pip install \
    https://download.pytorch.org/whl/cu128/torchvision-0.22.0%2Bcu128-cp311-cp311-manylinux_2_28_x86_64.whl#sha256=f3ac527d58b4c2043eb8d9e29fc56cd1751f36f2aaa6dc75e34ec54c951bcb9c

RUN pip install triton==3.3.1
# Copy scoring logic and model artifacts
COPY app.py /app.py

WORKDIR /

CMD lightning deploy app.py
