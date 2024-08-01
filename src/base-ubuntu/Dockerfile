FROM ubuntu

RUN apt-get update
COPY requirements.txt .
RUN apt-get install -y $(cat requirements.txt)

ENV TEST_KEY=
ENV SECOND_KEY=
COPY healthy .
COPY readme.sh .

CMD rm requirements.txt; sleep 500000000
