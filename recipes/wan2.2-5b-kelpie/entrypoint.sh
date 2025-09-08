#!/usr/bin/env bash
set -euo pipefail

echo "[boot] Container start"

MODEL_DIR="${WAN_MODEL_DIR:-/opt/Wan2.2-TI2V-5B}"
REPO_ID="${WAN_REPO_ID:-Wan-AI/Wan2.2-TI2V-5B}"

echo "[boot] Downloading model repo=${REPO_ID} -> ${MODEL_DIR}"
mkdir -p "${MODEL_DIR}"

# huggingface_hub[cli] already installed in image; skip re-install
retries=3
for attempt in $(seq 1 $retries); do
  if huggingface-cli download "${REPO_ID}" --local-dir "${MODEL_DIR}" --resume-download; then
    echo "[boot] Download completed (attempt ${attempt})"
    break
  fi
  echo "[boot][warn] Download attempt ${attempt} failed"
  if [ "${attempt}" -lt "${retries}" ]; then
    sleep 5
  else
    echo "[boot][error] Model download failed after ${retries} attempts (continuing; worker may retry)."
  fi
done


echo "[boot] Launching single kelpie worker (supervised)"
while true; do
  /usr/local/bin/kelpie "$@"
  rc=$?
  echo "[boot] kelpie exited rc=${rc}"
  if [ "${KELPIE_NO_RESTART:-0}" = "1" ]; then
    echo "[boot] KELPIE_NO_RESTART=1 -> not restarting"
    exit $rc
  fi
  if [ $rc -eq 0 ]; then
    echo "[boot] kelpie exited cleanly (rc=0); sleeping then restarting to stay warm"
  else
    echo "[boot][warn] kelpie crashed (rc=$rc); restarting after backoff"
  fi
  sleep 5
done
