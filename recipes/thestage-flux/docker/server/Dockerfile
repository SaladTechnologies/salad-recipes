FROM nvcr.io/nvidia/tritonserver:24.09-py3

RUN wget -O - https://openresty.org/package/pubkey.gpg | gpg --dearmor -o /usr/share/keyrings/openresty.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/openresty.gpg] http://openresty.org/package/ubuntu jammy main" | tee /etc/apt/sources.list.d/openresty.list > /dev/null \
    && apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -yq libssl-dev supervisor openresty \
    # Fix of this issue https://github.com/triton-inference-server/server/issues/7243
    && apt-get remove -yq python3-blinker python-blinker-doc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/project
ADD requirements.txt .

RUN pip install \
      --no-cache-dir \
      --extra-index-url https://download.pytorch.org/whl/nightly/cu128 \
      --requirement \
        requirements.txt

RUN pip install \
      --no-dependencies \
      --no-cache-dir \
      --extra-index-url=https://thestage.jfrog.io/artifactory/api/pypi/pypi-thestage-ai-production/simple \
        qlip-serve==0.1.15 \
        elastic_models[blackwell]==0.0.14

ENV PYTHONUNBUFFERED=1

ADD default.conf /usr/local/openresty/nginx/conf/nginx.conf
ADD supervisord.conf /etc/supervisor/supervisord.conf

ENV MODEL_TYPE=diffusion \
    MODEL_REPO=black-forest-labs/FLUX.1-schnell \
    MODEL_SIZE=S \
    MODEL_BATCH_SIZE=1

ENTRYPOINT ["supervisord"]