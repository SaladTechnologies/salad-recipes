#!/bin/bash
MODEL=${MODEL:-llama3.1:8b}
ollama run ${MODEL}

# Keep the container running
tail -f /dev/null