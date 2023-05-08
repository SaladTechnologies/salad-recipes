ARG PYVERSION=py39
FROM baseten/truss-server-base:3.9-gpu-v0.3.4

RUN pip install --upgrade pip --no-cache-dir \
    && rm -rf /root/.cache/pip

    
# HuggingFace pytorch gpu support needs mkl
RUN pip install mkl
    


RUN apt update
RUN apt install -y socat






COPY ./server_requirements.txt server_requirements.txt
RUN pip install -r server_requirements.txt --no-cache-dir && rm -rf /root/.cache/pip

COPY ./requirements.txt requirements.txt
RUN pip install -r requirements.txt --no-cache-dir && rm -rf /root/.cache/pip




ENV APP_HOME /app
WORKDIR $APP_HOME



COPY ./server /app
COPY ./model /app/model
COPY ./config.yaml /app/config.yaml










ENV INFERENCE_SERVER_PORT 8080
# CMD exec python3 /app/inference_server.py

CMD bash start.sh