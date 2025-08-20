FROM vllm/vllm-openai:v0.10.1

# Copy our env→CLI entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose the API port (Salad Container Gateway will forward to this)
EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
