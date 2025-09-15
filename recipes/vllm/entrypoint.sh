#!/usr/bin/env bash
set -euo pipefail

: "${MODEL_ID:?You must set MODEL_ID}"

exec python3 -m vllm.entrypoints.openai.api_server \
  --model "$MODEL_ID" \
  --host "${HOST:-::}" \
  --port "${PORT:-8000}" \
  ${DTYPE:+--dtype "$DTYPE"} \
  ${TP_SIZE:+--tensor-parallel-size "$TP_SIZE"} \
  ${PP_SIZE:+--pipeline-parallel-size "$PP_SIZE"} \
  ${MAX_MODEL_LEN:+--max-model-len "$MAX_MODEL_LEN"} \
  ${MAX_NUM_BATCH_TOKENS:+--max-num-batched-tokens "$MAX_NUM_BATCH_TOKENS"} \
  ${MAX_NUM_SEQS:+--max-num-seqs "$MAX_NUM_SEQS"} \
  ${GPU_MEM_UTIL:+--gpu-memory-utilization "$GPU_MEM_UTIL"} \
  ${QUANTIZATION:+--quantization "$QUANTIZATION"} \
  ${KV_CACHE_DTYPE:+--kv-cache-dtype "$KV_CACHE_DTYPE"} \
  ${DOWNLOAD_DIR:+--download-dir "$DOWNLOAD_DIR"} \
  ${TOKENIZER:+--tokenizer "$TOKENIZER"} \
  ${TRUST_REMOTE_CODE:+--trust-remote-code}
