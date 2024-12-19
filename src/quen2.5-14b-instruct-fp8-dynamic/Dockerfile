ARG tgi_version=3.0.1
FROM ghcr.io/huggingface/text-generation-inference:$tgi_version

COPY data /data
ENV MODEL_ID=neuralmagic-ent/Qwen2.5-14B-Instruct-FP8-dynamic
ENV HOSTNAME=::