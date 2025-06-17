#! /usr/bin/bash

huggingface-cli download \
  --local-dir ./models/llama318b \
  meta-llama/Llama-3.1-8B-Instruct \
  --exclude "original/*"