FROM python:3.10.18-slim-bookworm

ADD requirements.txt .

RUN pip install  \
    --no-cache-dir  \
    --requirement requirements.txt

RUN pip install \
      --no-dependencies \
      --extra-index-url=https://thestage.jfrog.io/artifactory/api/pypi/pypi-thestage-ai-production/simple \
      --no-cache-dir \
        qlip-serve==0.1.15 elastic_models[nvidia]==0.0.14