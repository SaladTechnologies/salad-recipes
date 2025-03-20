from openai import OpenAI

client = OpenAI(base_url="http://localhost:3000/v1", api_key="-")

chat = client.chat.completions.create(
    model="tgi",
    messages=[
        {
          "role": "user",
          "content": "Describe the inner workings of the hubble space telescope."
        }
    ],
    stream=False,
    max_completion_tokens=1024
)

print(chat.choices[0].message.content)
