FROM ubuntu:24.04

SHELL ["/bin/bash", "-c"]

RUN apt-get update && \
    apt-get install -y \
    build-essential \
    git \
    curl \
    wget \
    python3-pip \
    python3-venv \
    zip \
    unzip \
    htop \
    nvtop \
    jq \
    software-properties-common && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Create a script file sourced by both interactive and non-interactive bash shells
ENV BASH_ENV=/root/.bash_env
RUN touch "${BASH_ENV}"
RUN echo '. "${BASH_ENV}"' >> ~/.bashrc

# Download and install nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.2/install.sh | PROFILE="${BASH_ENV}" bash
RUN nvm install --lts && \
    nvm use --lts && \
    nvm alias default node

RUN curl -Lk 'https://code.visualstudio.com/sha/download?build=stable&os=cli-alpine-x64' -o vscode_cli.tar.gz && \
    tar -xf vscode_cli.tar.gz && \
    mv code /usr/local/bin/code && \
    rm vscode_cli.tar.gz

RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --upgrade pip && \
    /opt/venv/bin/pip install \
    jupyterlab
RUN echo "source /opt/venv/bin/activate" >> "/root/.bashrc"
ENV PATH="/opt/venv/bin:$PATH"


ENV JUPYTERLAB_DIR="/workspace/jupyterlab"
ENV JUPYTERLAB_PORT=8888
RUN mkdir -p /workspace/jupyterlab
RUN jupyter lab --generate-config && \
    echo "c.ServerApp.ip = '*'" >> /root/.jupyter/jupyter_server_config.py
RUN jupyter lab build


COPY . .
RUN chmod +x launch.sh
ENTRYPOINT ["/workspace/launch.sh"]

CMD ["sleep", "infinity"]