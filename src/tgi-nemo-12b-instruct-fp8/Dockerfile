FROM ghcr.io/huggingface/text-generation-inference:3.2.0

# We previously downloaded the model files using the `download-model` script.
COPY data /data
ENV MODEL_ID="context-labs/neuralmagic-mistral-nemo-12b-instruct-FP8"
