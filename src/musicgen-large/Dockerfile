ARG PYVERSION=py39
FROM baseten/truss-server-base:3.9-gpu-v0.3.4

RUN pip install --upgrade pip --no-cache-dir \
    && rm -rf /root/.cache/pip





RUN apt-get update
RUN apt-get install -y ffmpeg
RUN apt-get install -y socat
COPY ./system_packages.txt system_packages.txt
# RUN apt-get install --yes --no-install-recommends $(cat system_packages.txt)





COPY ./requirements.txt requirements.txt
RUN pip install -r requirements.txt --no-cache-dir




ENV APP_HOME /app
WORKDIR $APP_HOME



COPY ./server /app
COPY ./start.sh /app
COPY ./model /app/model
COPY ./config.yaml /app/config.yaml










ENV INFERENCE_SERVER_PORT 8080
CMD bash start.sh
