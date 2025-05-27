FROM ghcr.io/huggingface/text-generation-inference:3.3.0

# We previously downloaded the model files using the `download-model` script.
COPY model /model
ENV MODEL_ID="/model"

# Since we'll be including images in the payload, we want to set a higher payload limit.
ENV PAYLOAD_LIMIT=10000000