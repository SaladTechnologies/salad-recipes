#!/bin/bash

for f in model/*.safetensors; do
  echo "COPY $f /model/" >> Dockerfile
done
