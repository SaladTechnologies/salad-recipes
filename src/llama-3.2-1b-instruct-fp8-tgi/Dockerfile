ARG tgi_version=3.0.1
FROM ghcr.io/huggingface/text-generation-inference:$tgi_version

COPY data /data
ENV MODEL_ID=neuralmagic/Llama-3.2-1B-Instruct-FP8
ENV HOSTNAME=::