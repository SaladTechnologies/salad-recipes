#!/bin/bash
cd data/models && curl -O https://baseten-public.s3.us-west-2.amazonaws.com/models/whisper/small.pt &&
pip install git+https://github.com/openai/whisper.git &&
echo 'socat TCP6-LISTEN:8888,fork TCP4:127.0.0.1:8080 &'
socat TCP6-LISTEN:8888,fork TCP4:127.0.0.1:8080 &
cd .. &&
cd .. &&
python3 /app/inference_server.py