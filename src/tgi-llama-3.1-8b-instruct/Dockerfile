FROM ghcr.io/huggingface/text-generation-inference:3.3.0

COPY model/LICENSE /model/
COPY model/*.json /model/
COPY model/model-00001-of-00004.safetensors /model/
COPY model/model-00002-of-00004.safetensors /model/
COPY model/model-00003-of-00004.safetensors /model/
COPY model/model-00004-of-00004.safetensors /model/

ENV MODEL_ID="/model"