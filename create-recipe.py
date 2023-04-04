from transformers import pipeline
from truss import create

# name = 'gpt2'
name = 'bert-base-uncased'


# pipelineType = 'text-generation'
pipelineType = 'fill-mask'

model = pipeline(pipelineType, model=name)

create(model, target_directory=name)
