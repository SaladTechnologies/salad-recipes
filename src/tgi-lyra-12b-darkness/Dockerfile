FROM ghcr.io/huggingface/text-generation-inference:3.2.3

# huggingface-cli download --local-dir ./model DavidAU/MN-GRAND-Gutenberg-Lyra4-Lyra-12B-DARKNESS
# We're copying each file as its own layer to keep layer size smaller
COPY model/*.json /model/
COPY model/model-00001-of-00025.safetensors /model/
COPY model/model-00002-of-00025.safetensors /model/
COPY model/model-00003-of-00025.safetensors /model/
COPY model/model-00004-of-00025.safetensors /model/
COPY model/model-00005-of-00025.safetensors /model/
COPY model/model-00006-of-00025.safetensors /model/
COPY model/model-00007-of-00025.safetensors /model/
COPY model/model-00008-of-00025.safetensors /model/
COPY model/model-00009-of-00025.safetensors /model/
COPY model/model-00010-of-00025.safetensors /model/
COPY model/model-00011-of-00025.safetensors /model/
COPY model/model-00012-of-00025.safetensors /model/
COPY model/model-00013-of-00025.safetensors /model/
COPY model/model-00014-of-00025.safetensors /model/
COPY model/model-00015-of-00025.safetensors /model/
COPY model/model-00016-of-00025.safetensors /model/
COPY model/model-00017-of-00025.safetensors /model/
COPY model/model-00018-of-00025.safetensors /model/
COPY model/model-00019-of-00025.safetensors /model/
COPY model/model-00020-of-00025.safetensors /model/
COPY model/model-00021-of-00025.safetensors /model/
COPY model/model-00022-of-00025.safetensors /model/
COPY model/model-00023-of-00025.safetensors /model/
COPY model/model-00024-of-00025.safetensors /model/
COPY model/model-00025-of-00025.safetensors /model/

ENV MODEL_ID=/model
ENV QUANTIZE=fp8
ENV PORT=3000