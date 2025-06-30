# Use the official Ultralytics image as base
FROM ultralytics/ultralytics@sha256:9bc79ed22ec5939e429668a25c27f8cc7be3143af1bdabd0a29e81b3ea5982ef

# Set the working directory to /app
WORKDIR /app

# Copy the inference folder to /app/inference
COPY /inference /app/inference

# Install any additional system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --upgrade pip \
    && pip install --no-cache-dir -r inference/requirements.txt
WORKDIR /app/inference

# Expose port 8000
EXPOSE 80

CMD ["uvicorn", "app:app", "--host", "::", "--port", "80"]
