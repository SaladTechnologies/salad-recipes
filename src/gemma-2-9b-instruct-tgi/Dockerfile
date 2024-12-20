ARG tgi_version=3.0.1
FROM ghcr.io/huggingface/text-generation-inference:$tgi_version

COPY data /data
ENV MODEL_ID=google/gemma-2-9b-it
ENV HOSTNAME=::