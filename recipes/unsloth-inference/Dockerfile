FROM unsloth/unsloth:stable
ENV HF_HUB_ENABLE_HF_TRANSFER=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY unsloth-inference.py /app/

# Ensure runtime deps for the API layer are present
RUN pip install --no-cache-dir --upgrade \
    fastapi \
    uvicorn[standard] \
    unsloth_zoo \
    && pip cache purge
EXPOSE 8000
ENTRYPOINT ["python", "-m", "uvicorn"]
CMD ["unsloth-inference:app", "--host", "::", "--port", "8000"]
