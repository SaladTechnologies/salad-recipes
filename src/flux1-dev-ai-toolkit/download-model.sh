#! /bin/bash

huggingface-cli download --local-dir ./model --token $HF_TOKEN black-forest-labs/FLUX.1-dev --exclude flux1-dev.safetensors