# Use the specified base image
FROM nvidia/cuda:12.2.0-devel-ubuntu22.04 AS base

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3-pip \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set Python3 as default
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1

# Upgrade pip
RUN pip install --upgrade pip

# Install Flash Attention 2 dependencies
RUN pip install --upgrade setuptools

# Install required Python packages
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Install Flash Attention 2
RUN pip install wheel && \
    pip install flash-attn --no-build-isolation

# Copy the application code
COPY . /app
WORKDIR /app

# Expose the port
EXPOSE 8000

# Preload Whisper v3 large model by downloading it during the build process
RUN python -c "import whisper; whisper.load_model('large-v3')"

CMD ["uvicorn", "main:app", "--host", "::", "--port", "8000", "--workers", "2"]
