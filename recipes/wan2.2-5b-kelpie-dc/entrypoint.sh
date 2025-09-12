#!/usr/bin/env bash
set -u -o pipefail

echo "[boot] container start"

MODEL_DIR="${WAN_MODEL_DIR:-/opt/Wan2.2-TI2V-5B}"
REPO_ID="${WAN_REPO_ID:-Wan-AI/Wan2.2-TI2V-5B}"
STATE_DIR="/opt/kelpie/state"
LOG_DIR="${KELPIE_LOG_DIR:-/app}"
GPUS="${GPUS:-0 1 2 3 4 5 6 7}"
BACKOFF="${BACKOFF_SEC:-5}"

# Ensure deps/dirs
mkdir -p "$STATE_DIR" "$MODEL_DIR" "$LOG_DIR" || true
chmod 777 "$STATE_DIR" || true
command -v tmux >/dev/null 2>&1 || echo "[boot][warn] tmux not found (apt-get install -y tmux)"

# Optional model prefetch (won’t crash PID 1 if it fails)
if command -v huggingface-cli >/dev/null 2>&1; then
  echo "[boot] prefetch repo=${REPO_ID} -> ${MODEL_DIR}"
  huggingface-cli download "$REPO_ID" --local-dir "$MODEL_DIR" --resume-download || \
    echo "[boot][warn] prefetch failed; workers can still download"
fi

# Start one tmux session per GPU (simple restart loop inside each session)
for g in $GPUS; do
  name="kelpie_${g}"
  logf="${LOG_DIR}/kelpie_gpu${g}.log"
  # kill any stale session with same name
  tmux kill-session -t "$name" 2>/dev/null || true

  echo "[boot] starting $name (GPU $g) log=$logf"
  tmux new-session -d -s "$name" \
    "while true; do \
       CUDA_VISIBLE_DEVICES=$g \
       KELPIE_STATE_FILE=${STATE_DIR}/kelpie-gpu${g}-\$(date +%s%N).json \
       /usr/local/bin/kelpie |& tee -a '$logf' ; \
       echo \"[kelpie_$g] exited; restarting in ${BACKOFF}s\" | tee -a '$logf'; \
       sleep ${BACKOFF}; \
     done"
  sleep 1
done

echo "[boot] sessions up:"
tmux ls || true

# Keep PID 1 alive forever
tail -F /dev/null
