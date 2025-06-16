#! /bin/bash

set -e
if [ -z "$OLLAMA_MODEL_NAME" ]; then
  echo "OLLAMA_MODEL_NAME is not set. Please set it to your Ollama model name."
  exit 1
fi

ollama serve &

# Poll GET / to check if the server is up
while ! curl -s http://localhost:11434/ > /dev/null; do
  echo "Waiting for Ollama server to start..."
  sleep 1
done
echo "Ollama server is up."

ollama run "$OLLAMA_MODEL_NAME"
echo "Ollama model $OLLAMA_MODEL_NAME is running."
touch /tmp/ollama_model_ready

sleep infinity