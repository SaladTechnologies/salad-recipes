ARG PYVERSION=py39
FROM baseten/truss-server-base:3.9-gpu-v0.3.4

RUN pip install --upgrade pip --no-cache-dir \
    && rm -rf /root/.cache/pip











COPY ./requirements.txt requirements.txt
RUN pip install -r requirements.txt --no-cache-dir && rm -rf /root/.cache/pip




ENV APP_HOME /app
WORKDIR $APP_HOME



COPY ./server /app
COPY ./model /app/model
COPY ./config.yaml /app/config.yaml

COPY . /app



RUN apt update
RUN apt install -y socat






ENV INFERENCE_SERVER_PORT 8080
CMD bash start.sh
## CMD exec python3 /app/inference_server.py
