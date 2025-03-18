FROM ghcr.io/huggingface/text-generation-inference:3.2.0

# We previously downloaded the model files using the `download-model` script.
COPY data /data
ENV MODEL_ID="Qwen/Qwen2.5-VL-7B-Instruct"

# Since we'll be including images in the payload, we want to set a higher payload limit.
ENV PAYLOAD_LIMIT=10000000