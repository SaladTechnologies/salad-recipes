#!/bin/bash

set -e
if [[ -z "$CODE" ]]; then
  echo "Missing CODE env var"
  exit 1
fi

exec ./inference-launcher node start --code "$CODE"
