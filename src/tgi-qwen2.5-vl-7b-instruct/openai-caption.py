from openai import OpenAI
import os

openai_api_key = os.getenv("OPENAI_API_KEY", "-")

client = OpenAI(
    base_url="http://localhost:3000/v1", api_key=openai_api_key)
model = "tgi"
client = OpenAI(api_key=openai_api_key)
model = "gpt-4o-mini"

chat = client.chat.completions.create(
    model=model,
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "Describe the image in detail using comma-separated descriptor tags, with more prominent features toward the front of the list"
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "https://salad-benchmark-assets.download/coco2017/train2017/000000000094.jpg",
                        "detail": "low"
                    }
                }
            ]
        }
    ],
    stream=False,
    max_completion_tokens=256
)

print(chat.choices[0].message.content)
print(chat.usage)
