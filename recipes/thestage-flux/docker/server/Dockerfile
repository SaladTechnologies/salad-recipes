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

RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cu128 \
      torch==2.7.0+cu128 torchvision==0.22.0+cu128 torchaudio==2.7.0+cu128

RUN pip install --no-cache-dir \
      --index-url=https://thestage.jfrog.io/artifactory/api/pypi/pypi-thestage-ai-production/simple \
      --extra-index-url=https://pypi.org/simple \
      --no-deps \
      thestage-elastic-models[blackwell]==0.1.2 \
      thestage-elastic-models-cli==0.0.18

RUN pip install \
      --no-cache-dir \
      --index-url=https://thestage.jfrog.io/artifactory/api/pypi/pypi-thestage-ai-production/simple \
      --extra-index-url=https://pypi.org/simple \
      --requirement \
        requirements.txt

ADD lua /etc/openresty/lua/
ADD default.conf /usr/local/openresty/nginx/conf/nginx.conf
ADD supervisord.conf /etc/supervisor/supervisord.conf

ENV MODEL_TYPE=diffusion \
    MODEL_REPO=black-forest-labs/FLUX.1-schnell \
    MODEL_SIZE=S \
    MODEL_BATCH=1

ENTRYPOINT ["supervisord"]