FROM ubuntu
RUN echo "CD into /app to get started." > readme.txt

WORKDIR /app

RUN apt-get update
COPY requirements.txt .
RUN apt-get install -y $(cat requirements.txt)


RUN pip install fastapi --break-system-packages
RUN pip install "uvicorn[standard]" --break-system-packages
RUN pip install requests --break-system-packages

ENV TEST_KEY=
ENV SECOND_KEY=
ENV COLUMNS=80
ENV LINES=24
COPY . .


CMD rm requirements.txt; uvicorn server:app --host '::' --port 8000 & sleep 500000000
