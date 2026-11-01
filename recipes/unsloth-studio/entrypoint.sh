#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# SaladCloud entrypoint for Unsloth Studio
# ---------------------------------------------------------------------------
# Environment variables (set on the SaladCloud container group):
#   UNSLOTH_PASSWORD  Studio admin password                  (default: change-me-please)
#   STUDIO_PORT       internal web port                      (default: 8080)
#   EXPOSE_MODE       "cloudflare" -> public *.trycloudflare.com URL (in the logs)
#                     "gateway"    -> listen on '::' (IPv6/dual-stack), exposed
#                                     via the SaladCloud Container Gateway
#                     (default: cloudflare)
#   HF_TOKEN          (optional) Hugging Face login -> push/pull models
# ---------------------------------------------------------------------------
set -euo pipefail

PASS="${UNSLOTH_PASSWORD:-change-me-please}"
PORT="${STUDIO_PORT:-8080}"
MODE="${EXPOSE_MODE:-cloudflare}"
UNS="/root/.unsloth/studio/unsloth_studio/bin/unsloth"

# Set the admin password NON-INTERACTIVELY (avoids the "New password:" prompt
# that would block a headless container). Studio reads this variable on first
# start; the user can change it later in the UI.
export UNSLOTH_STUDIO_PASSWORD="${PASS}"

# GGUF engine (llama.cpp) on GPU:
#  - llama-server has no rpath to its own libs (libllama-server-impl.so,
#    libggml*.so) -> its lib directory must be on the path.
#  - the CUDA build (libggml-cuda.so) needs torch's CUDA runtime libs
#    (libcudart, libcublas, libnvrtc) -> add those directories too.
_NVLIB="/root/.unsloth/studio/unsloth_studio/lib/python3.13/site-packages/nvidia"
export LD_LIBRARY_PATH="/root/.unsloth/llama.cpp/build/bin:${_NVLIB}/cuda_runtime/lib:${_NVLIB}/cublas/lib:${_NVLIB}/cuda_nvrtc/lib:${LD_LIBRARY_PATH:-}"

# GPU-accelerated GGUF: the image ships a CPU-only llama.cpp (built without a
# GPU in CI). On first boot (real GPU present -> correct detection, GitHub
# download works from Salad) install Unsloth's prebuilt CUDA build.
# IMPORTANT: when pointed at an existing directory the installer sometimes
# DELETES it without reinstalling (first pass) -> install into a TEMPORARY
# directory and only replace the CPU llama.cpp (which keeps serving GGUF in the
# meantime) once the CUDA build is validated (atomic swap). No "runtime not
# installed" window.
_STUDIO_PY="/root/.unsloth/studio/unsloth_studio/bin/python"
_LC_INSTALLER="/root/.unsloth/studio/unsloth_studio/lib/python3.13/site-packages/studio/install_llama_prebuilt.py"
_LC_DIR="/root/.unsloth/llama.cpp"
_LC_TMP="/root/.unsloth/llama.cpp.cuda"
if [ -x "${_STUDIO_PY}" ] && [ -f "${_LC_INSTALLER}" ]; then
  echo "[entrypoint] Installing llama.cpp CUDA (GPU GGUF) in the background..."
  (
    ok=0
    for attempt in 1 2 3; do
      rm -rf "${_LC_TMP}"
      if "${_STUDIO_PY}" "${_LC_INSTALLER}" --install-dir "${_LC_TMP}" \
           && [ -f "${_LC_TMP}/build/bin/libggml-cuda.so" ]; then
        ok=1; break
      fi
      echo "[entrypoint] attempt ${attempt} failed, retrying..."; sleep 5
    done
    if [ "${ok}" = "1" ]; then
      rm -rf "${_LC_DIR}" && mv "${_LC_TMP}" "${_LC_DIR}"
      ldconfig 2>/dev/null || true
      echo "[entrypoint] llama.cpp CUDA ready (GPU-accelerated GGUF)."
    else
      rm -rf "${_LC_TMP}"
      echo "[entrypoint] llama.cpp CUDA install failed -> GGUF stays on CPU."
    fi
  ) > /root/llama_cuda_install.log 2>&1 &
fi

# Optional HF login (lets you save your LoRAs off the box)
if [ -n "${HF_TOKEN:-}" ]; then
  echo "[entrypoint] Hugging Face login..."
  /root/.unsloth/studio/unsloth_studio/bin/huggingface-cli login --token "${HF_TOKEN}" || \
    echo "[entrypoint] (HF login skipped)"
fi

# GPU diagnostic (is "no GPU backend available" coming from the container or from Studio?)
echo "[entrypoint] GPU check (nvidia-smi):"
nvidia-smi -L 2>&1 | head -2 || echo "[entrypoint]   nvidia-smi unavailable (no GPU exposed to the container?)"

# Network options depending on the exposure mode
if [ "${MODE}" = "gateway" ]; then
  # --secure (Cloudflare tunnel) fails from a SaladCloud container (cloudflared
  # egress blocked) -> use --no-secure.
  # IMPORTANT: the SaladCloud Container Gateway routes over IPv6 -> Studio must
  # listen on '::' (dual-stack), otherwise 503. (0.0.0.0 = IPv4 only = unreachable.)
  HOST_BIND="${STUDIO_HOST:-::}"
  NET_OPTS=(--no-secure -H "${HOST_BIND}" -p "${PORT}")
  echo "[entrypoint] Gateway mode: Studio listening on [${HOST_BIND}]:${PORT} (--no-secure, IPv6)"
  echo "[entrypoint] -> exposed via the SaladCloud Container Gateway (port ${PORT})."
else
  NET_OPTS=(-p "${PORT}" --secure)
  echo "[entrypoint] Cloudflare mode: the *.trycloudflare.com URL will appear below."
  echo "[entrypoint]   (NB: --secure often fails on SaladCloud -> prefer EXPOSE_MODE=gateway)"
fi

echo "[entrypoint] Starting Unsloth Studio (password via UNSLOTH_STUDIO_PASSWORD)..."
exec "${UNS}" studio "${NET_OPTS[@]}"
