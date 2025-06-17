#! /usr/bin/bash

huggingface-cli download \
  --local-dir ./models/llama3211bvi \
  meta-llama/Llama-3.2-11B-Vision-Instruct \
  --exclude "original/*"