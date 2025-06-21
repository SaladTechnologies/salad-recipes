FROM nvcr.io/nvidia/tritonserver:24.09-py3

RUN wget -O - https://openresty.org/package/pubkey.gpg | gpg --dearmor -o /usr/share/keyrings/openresty.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/openresty.gpg] http://openresty.org/package/ubuntu jammy main" | tee /etc/apt/sources.list.d/openresty.list > /dev/null \
    && apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -yq libssl-dev supervisor openresty \
    && rm -rf /var/lib/apt/lists/*

 RUN pip install --no-cache-dir qlip-serve==0.1.15 --extra-index-url=https://thestage.jfrog.io/artifactory/api/pypi/pypi-thestage-ai-production/simple &&  \
    pip install --no-cache-dir elastic_models[blackwell]==0.0.11 --index-url https://thestage.jfrog.io/artifactory/api/pypi/pypi-thestage-ai-production/simple --extra-index-url https://pypi.nvidia.com --extra-index-url https://pypi.org/simple && \
    pip install --no-cache-dir --pre torch --index-url https://download.pytorch.org/whl/nightly/cu128 && \
    pip install --no-cache-dir --pre torchvision --index-url https://download.pytorch.org/whl/nightly/cu128

ENV PYTHONUNBUFFERED=1

WORKDIR /opt/project

ADD default.conf /usr/local/openresty/nginx/conf/nginx.conf
ADD supervisord.conf /etc/supervisor/supervisord.conf

ENTRYPOINT ["supervisord"]