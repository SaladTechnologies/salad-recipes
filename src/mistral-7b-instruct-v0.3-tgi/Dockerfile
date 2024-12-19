ARG tgi_version=3.0.1
FROM ghcr.io/huggingface/text-generation-inference:$tgi_version

COPY data /data
ENV MODEL_ID=mistralai/Mistral-7B-Instruct-v0.3
ENV HOSTNAME=::