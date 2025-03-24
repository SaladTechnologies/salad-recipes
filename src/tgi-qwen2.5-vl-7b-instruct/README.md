# Qwen 2.5 VL 7B Instruct on TGI

This recipe creates a TGI server running [qwen2.5-vl-7b-instruct](https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct) model, a vision-language model from Alibaba.


```js
const accessDomainName = "https://some-access-domain.salad.cloud"
const apiKey = "your-salad-api-key"
const resp = await fetch(`${accessDomainName}/v1`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Salad-Api-Key": apiKey
  },
  body: JSON.stringify({
    model: "tgi",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Describe the image in detail"
          },
          {
            type: "image_url",
            image_url: {
              url: "https://salad-benchmark-assets.download/coco2017/train2017/000000000094.jpg"
            }
          }
        ]
      }
    ],
    stream: false,
    max_completion_tokens: 256
  })
})
const chat = await resp.json()
console.log(chat.choices[0].message.content)
```
