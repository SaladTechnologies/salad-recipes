# Use the official Ultralytics image as base
FROM ultralytics/ultralytics:latest

# Set the working directory to /app
WORKDIR /app

# Copy the inference folder to /app/inference
COPY /inference /app/inference

# Install any additional system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r inference/requirements.txt

WORKDIR /app/inference

# Expose port 8000
EXPOSE 8000

CMD ["uvicorn", "fast:app", "--host", "0.0.0.0", "--port", "80"]
