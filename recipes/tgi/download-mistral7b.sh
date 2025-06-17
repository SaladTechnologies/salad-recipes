#! /usr/bin/bash

huggingface-cli download \
  --local-dir ./models/mistral7b \
  mistralai/Mistral-7B-Instruct-v0.3 \
  --exclude "consolidated.safetensors"
  
