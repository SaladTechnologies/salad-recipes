ARG tgi_version=3.0.1
FROM ghcr.io/huggingface/text-generation-inference:$tgi_version

COPY data /data
ENV MODEL_ID=neuralmagic/Mistral-7B-Instruct-v0.3-FP8
ENV HOSTNAME=::