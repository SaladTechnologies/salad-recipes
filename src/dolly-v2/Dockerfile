ARG PYVERSION=py39
FROM baseten/truss-server-base:3.9-gpu-v0.3.4

RUN pip install --upgrade pip --no-cache-dir







RUN apt-get update
RUN apt-get install -y socat



COPY ./requirements.txt requirements.txt
RUN pip install -r requirements.txt --no-cache-dir




ENV APP_HOME /app
WORKDIR $APP_HOME



COPY ./server /app
COPY ./model /app/model
COPY ./config.yaml /app/config.yaml


COPY ./start.sh /app
COPY ./packages /packages







ENV INFERENCE_SERVER_PORT 8080
CMD exec python3 /app/inference_server.py
