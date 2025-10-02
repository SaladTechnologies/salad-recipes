#! /bin/bash

set -euo pipefail

usage="Usage: $0 --comfy-version <version> --api-version <version> --torch-version <version> --cuda-version <version>"
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --comfy-version) comfy_version="$2"; shift ;;
        --api-version) api_version="$2"; shift ;;
        --torch-version) torch_version="$2"; shift ;;
        --cuda-version) cuda_version="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; echo "$usage"; exit 1 ;;
    esac
    shift
done

if [[ -z "${comfy_version:-}" || -z "${api_version:-}" || -z "${torch_version:-}" || -z "${cuda_version:-}" ]]; then
    echo "Missing required parameters."
    echo "$usage"
    exit 1
fi

dockerfile_extensions=("dreamshaper8" "flux1dev" "flux1schnell" "sd35medium" "sdxl")

for extension in "${dockerfile_extensions[@]}"; do
  docker build -t "ghcr.io/saladtechnologies/comfyui-api:comfy${comfy_version}-api${api_version}-torch${torch_version}-cuda${cuda_version}-${extension}" \
    --build-arg comfy_version="$comfy_version" \
    --build-arg api_version="$api_version" \
    --build-arg torch_version="$torch_version" \
    --build-arg cuda_version="$cuda_version" \
    -f Dockerfile."$extension" .
done