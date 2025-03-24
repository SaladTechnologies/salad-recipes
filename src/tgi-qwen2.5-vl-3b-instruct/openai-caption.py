from openai import OpenAI

client = OpenAI(base_url="http://localhost:3000/v1", api_key="-")

chat = client.chat.completions.create(
    model="tgi",
    messages=[
        {
          "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "What is in this image? Include details."
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/transformers/rabbit.png"
                    }
                }
            ]
        }
    ],
    stream=False,
    max_completion_tokens=256
)

print(chat.choices[0].message.content)
