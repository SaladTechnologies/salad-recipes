FROM python:3.10.18-slim-bookworm

ADD requirements.txt .

RUN pip install  \
    --no-cache-dir  \
    --requirement requirements.txt

RUN pip install \
      --no-dependencies \
      --extra-index-url=https://thestage.jfrog.io/artifactory/api/pypi/pypi-thestage-ai-production/simple \
      --no-cache-dir \
        thestage-elastic-models-cli==0.0.18