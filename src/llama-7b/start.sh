#!/bin/bash
cd data && curl -O https://baseten-public.s3.us-west-2.amazonaws.com/models/llama/pytorch_model-00001-of-00002.bin &&
curl -O https://baseten-public.s3.us-west-2.amazonaws.com/models/llama/pytorch_model-00002-of-00002.bin &&
echo 'socat TCP6-LISTEN:8888,fork TCP4:127.0.0.1:8080 &'
socat TCP6-LISTEN:8888,fork TCP4:127.0.0.1:8080 &
cd .. &&
python3 /app/inference_server.py