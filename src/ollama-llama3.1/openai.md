Ollama  has built-in compatibility with the OpenAI  [Chat Completions API](https://github.com/ollama/ollama/blob/main/docs/openai.md), making it possible to use more tooling and applications with Ollama.

## Usage

### cURL

To invoke Ollama’s OpenAI compatible API endpoint, use the same  [OpenAI format](https://platform.openai.com/docs/quickstart?context=curl)  and change the hostname to your salad url. Example:`https://salad-url.salad.cloud`:

```shell
curl https://salad-url.salad.cloud/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "llama3.1:8b",
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful assistant."
            },
            {
                "role": "user",
                "content": "Hello!"
            }
        ]
    }'

```

### OpenAI Python library

```python
from openai import OpenAI

client = OpenAI(
    base_url = 'https://salad-url.salad.cloud/v1',
    api_key='ollama', # required, but unused
)

response = client.chat.completions.create(
  model="llama3.1:8b",
  messages=[
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Who won the world series in 2020?"},
    {"role": "assistant", "content": "The LA Dodgers won in 2020."},
    {"role": "user", "content": "Where was it played?"}
  ]
)
print(response.choices[0].message.content)

```

### OpenAI JavaScript library

```javascript
import OpenAI from 'openai'

const openai = new OpenAI({
  baseURL: 'https://salad-url.salad.cloud/v1',
  apiKey: 'ollama', // required but unused
})

const completion = await openai.chat.completions.create({
  model: 'llama3.1:8b',
  messages: [{ role: 'user', content: 'Why is the sky blue?' }],
})

console.log(completion.choices[0].message.content)
```