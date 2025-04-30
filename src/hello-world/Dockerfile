FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# It is important to use `--host *` to allow access on ipv6
# networks, such as SaladCloud.
CMD ["uvicorn", "app:app", "--host", "*", "--port", "8000"]