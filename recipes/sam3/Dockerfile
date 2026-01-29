# Use the official Ultralytics image as base (includes SAM3 support)
# Using latest tag to ensure SAM3 support (requires ultralytics >= 8.3.237)
FROM ultralytics/ultralytics:latest

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,utility

# Set the working directory to /app
WORKDIR /app

# Copy the inference folder to /app/inference
COPY inference /app/inference

# Install any additional dependencies
RUN pip install --no-cache-dir -r inference/requirements.txt

WORKDIR /app/inference

# Expose port 80
EXPOSE 80


CMD ["uvicorn", "app:app", "--host", "::", "--port", "80"]
