ARG PYVERSION=py39
FROM baseten/truss-server-base:3.9-gpu-v0.4.9

ENV PYTHON_EXECUTABLE python3


RUN grep -w 'ID=debian\|ID_LIKE=debian' /etc/os-release || { echo "ERROR: Supplied base image is not a debian image"; exit 1; }
RUN $PYTHON_EXECUTABLE -c "import sys; sys.exit(0) if sys.version_info.major == 3 and sys.version_info.minor >=8 and sys.version_info.minor <=11 else sys.exit(1)" \
    || { echo "ERROR: Supplied base image does not have 3.8 <= python <= 3.11"; exit 1; }


RUN pip install --upgrade pip --no-cache-dir


# If user base image is supplied in config, apply build commands from truss base image


RUN apt-get update
RUN apt-get install -y socat












COPY ./requirements.txt requirements.txt
RUN pip install -r requirements.txt --no-cache-dir





COPY ./cache_warmer.py /cache_warmer.py
        
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py .gitattributes PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py README.md PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py added_tokens.json PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py config.json PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py merges.txt PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py pytorch_model-00001-of-00002.bin PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py pytorch_model-00002-of-00002.bin PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py pytorch_model.bin.index.json PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py runs/events.out.tfevents.1672953635.uft-2.1037250.0 PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py runs/events.out.tfevents.1672954410.uft-2.1044935.0 PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py runs/events.out.tfevents.1672955570.uft-2.1055948.0 PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py runs/events.out.tfevents.1672956702.uft-2.1066484.0 PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py runs/events.out.tfevents.1672957209.uft-2.1071189.0 PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py runs/events.out.tfevents.1672964235.uft-2.1134893.0 PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py runs/events.out.tfevents.1672964557.uft-2.1138191.0 PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py runs/events.out.tfevents.1672974217.uft-2.1224302.0 PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py runs/events.out.tfevents.1672974396.uft-2.1226068.0 PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py runs/events.out.tfevents.1672974541.uft-2.1227652.0 PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py runs/events.out.tfevents.1673061987.uft-2.2002177.0 PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py runs/events.out.tfevents.1673062187.uft-2.2004200.0 PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py special_tokens_map.json PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py tokenizer.json PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py tokenizer_config.json PygmalionAI/pygmalion-6b 
            
RUN $PYTHON_EXECUTABLE /cache_warmer.py vocab.json PygmalionAI/pygmalion-6b 
            
        



ENV APP_HOME /app
WORKDIR $APP_HOME



# Copy data before code for better caching

COPY ./server /app
COPY ./model /app/model
COPY ./start.sh /app
COPY ./config.yaml /app/config.yaml








ENV INFERENCE_SERVER_PORT 8080
ENV SERVER_START_CMD="python3 /app/inference_server.py"
CMD bash start.sh

## ENTRYPOINT ["python3", "/app/inference_server.py"]
