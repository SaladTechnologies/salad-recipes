
## Messages API

Text Generation Inference (TGI) supports the Messages API, which is fully compatible with the OpenAI Chat Completion API. You can use OpenAI’s client libraries or third-party libraries expecting OpenAI schema to interact with TGI’s Messages API. Below are some examples of how to utilize this compatibility. Replace "https://salad-url.salad.cloud" with your container url

## Making a Request

You can make a request to TGI’s Messages API using  `curl`. Here’s an example:

    curl https://salad-url.salad.cloud/v1/chat/completions \
    -X POST \
    -d '{
    "model": "tgi",
    "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "What is deep learning?"
    }
    ],
    "stream": true,
    "max_tokens": 20
    }' \
    -H 'Content-Type: application/json'
 
## Streaming

You can also use OpenAI’s Python client library to make a streaming request. Here’s how:


    from openai import OpenAI
    
    # init the client but point it to TGI
    client = OpenAI(
        base_url="https://salad-url.salad.cloud/v1",
        api_key="-"
    )
    
    chat_completion = client.chat.completions.create(
        model="tgi",
        messages=[
            {"role": "system", "content": "You are a helpful assistant." },
            {"role": "user", "content": "What is deep learning?"}
        ],
        stream=True
    )
    
    # iterate and print stream
    for message in chat_completion:
        print(message)

## Synchronous

If you prefer to make a synchronous request, you can do so like this:


    from openai import OpenAI
    
    # init the client but point it to TGI
    client = OpenAI(
        base_url="https://salad-url.salad.cloud/v1",
        api_key="-"
    )
    
    chat_completion = client.chat.completions.create(
        model="tgi",
        messages=[
            {"role": "system", "content": "You are a helpful assistant." },
            {"role": "user", "content": "What is deep learning?"}
        ],
        stream=False
    )
    
    print(chat_completion)
