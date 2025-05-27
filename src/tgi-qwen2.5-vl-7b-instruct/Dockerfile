FROM ghcr.io/huggingface/text-generation-inference:3.3.0

# We previously downloaded the model files using the `download-model` script.
COPY model/*.json /model/
COPY model/*.txt /model/
COPY model/model-00001-of-00005.safetensors /model/
COPY model/model-00002-of-00005.safetensors /model/
COPY model/model-00003-of-00005.safetensors /model/
COPY model/model-00004-of-00005.safetensors /model/
COPY model/model-00005-of-00005.safetensors /model/

ENV MODEL_ID="/model"

# Since we'll be including images in the payload, we want to set a higher payload limit.
ENV PAYLOAD_LIMIT=10000000