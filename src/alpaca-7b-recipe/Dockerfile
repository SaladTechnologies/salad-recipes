ARG PYVERSION=py38
FROM baseten/truss-server-base:3.8-gpu-v0.4.9

ENV PYTHON_EXECUTABLE python3


RUN grep -w 'ID=debian\|ID_LIKE=debian' /etc/os-release || { echo "ERROR: Supplied base image is not a debian image"; exit 1; }
RUN $PYTHON_EXECUTABLE -c "import sys; sys.exit(0) if sys.version_info.major == 3 and sys.version_info.minor >=8 and sys.version_info.minor <=11 else sys.exit(1)" \
    || { echo "ERROR: Supplied base image does not have 3.8 <= python <= 3.11"; exit 1; }


RUN pip install --upgrade pip --no-cache-dir


# If user base image is supplied in config, apply build commands from truss base image

RUN apt-get update
RUN apt-get install -y socat socat
RUN apt-get install -y curl













COPY ./requirements.txt requirements.txt
RUN pip install -r requirements.txt --no-cache-dir








ENV APP_HOME /app
WORKDIR $APP_HOME



# Copy data before code for better caching
COPY ./data /app/data

COPY ./server /app
COPY ./start.sh /app

COPY ./config.yaml /app/config.yaml

RUN cd /app/data && curl -O https://baseten-public.s3.us-west-2.amazonaws.com/models/alpaca/pytorch_model-00001-of-00002.bin && curl -O https://baseten-public.s3.us-west-2.amazonaws.com/models/alpaca/pytorch_model-00002-of-00002.bin

COPY ./model /app/model



ENV INFERENCE_SERVER_PORT 8080
ENV SERVER_START_CMD="python3 /app/inference_server.py"
CMD bash start.sh

## ENTRYPOINT ["python3", "/app/inference_server.py"]

