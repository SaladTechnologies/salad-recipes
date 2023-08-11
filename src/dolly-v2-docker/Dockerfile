FROM pytorch/pytorch:2.0.1-cuda11.7-cudnn8-runtime

WORKDIR /app

ARG DEBIAN_FRONTEND=noninteractive
ARG MODEL="databricks/dolly-v2-3b"
ARG BRANCH=float16
ENV MODEL_DIR=/models
ENV MODEL=${MODEL}
ENV TZ=Etc/UTC
ENV PYTHONUNBUFFERED 1

RUN apt-get update -y && apt-get upgrade -y && apt-get install --no-install-recommends --no-install-suggests -y \
    git \
    wget \
    libgl1 \
    libglib2.0-0 \
    build-essential

RUN apt-get install git
RUn apt-get install git-lfs

RUN git lfs clone "https://huggingface.co/databricks/dolly-v2-3b" \
    "/models/${MODEL}"
#COPY pytorch_model.bin /models/${MODEL}/pytorch_model.bin

# We need the latest pip
RUN pip install --upgrade --no-cache-dir pip

# Install dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt 

COPY web.py .
COPY model.py .


CMD ["uvicorn", "web:app", "--port", "8888", "--host", "::"]