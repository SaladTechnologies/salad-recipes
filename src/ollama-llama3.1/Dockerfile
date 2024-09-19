FROM nvidia/cuda:12.2.0-devel-ubuntu22.04 AS base
ENV DEBIAN_FRONTEND=noninteractive

# Install necessary packages
RUN apt-get update && apt-get install -y curl ca-certificates software-properties-common

# Download the correct binary for the architecture
RUN curl -fsSL https://ollama.com/install.sh | sh

# Make the binary executable
# RUN chmod +x /usr/bin/ollama

# Set environment variables
ENV OLLAMA_HOST=0.0.0.0

# Expose the necessary port
EXPOSE 11434 

# Copy configuration files
COPY .ollama/ /root/.ollama/
COPY --chmod=755 ./run.sh /app/run.sh
# Default command to run the application
ENTRYPOINT ollama serve & /app/run.sh