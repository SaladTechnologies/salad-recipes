import requests
import sys
import os
import json
import base64
import mimetypes

command = sys.argv[0]
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    print("Please set the OPENAI_API_KEY environment variable.")
    sys.exit(1)

usage = f"Usage: python {command} /path/to/images"
example = f"Example: python {command} /path/to/images"
if len(sys.argv) != 2:
    print(usage)
    print(example)
    sys.exit(1)

image_dir = sys.argv[1]
if not os.path.isdir(image_dir):
    print(f"{image_dir} is not a directory.")
    sys.exit(1)

endpoint = "https://api.openai.com/v1/chat/completions"


def get_caption_for_one_image(file: str):
    print(f"Getting caption for {file}")
    with open(file, "rb") as f:
        image_data = f.read()
    image_base64 = base64.b64encode(image_data).decode('utf-8')
    image_mime_type = mimetypes.guess_type(file)[0]
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f"Bearer {openai_api_key}"
    }
    data = {
        "model": "gpt-4.1-nano",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"Generate a short caption for this image (100 words or less) that captures composition and details about the subject",
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{image_mime_type};base64,{image_base64}"},
                    }
                ]
            }
        ],
        "stream": False,
        "max_completion_tokens": 128
    }

    response = requests.post(endpoint, headers=headers, json=data)
    if response.status_code == 200:
        body = response.json()
        if 'choices' in body and len(body['choices']) > 0:
            caption = body['choices'][0]['message']['content']
            return caption
    else:
        print(f"Error: {response.status_code} - {response.text}")
        return None
    return None


if __name__ == "__main__":
    # Links looks like { local_path: remote_url }
    for local_path in os.listdir(image_dir):
        if local_path.startswith("."):
            continue
        if local_path.endswith(".txt"):
            continue
        if local_path.endswith(".json"):
            continue
        local_path = os.path.join(image_dir, local_path)
        if not os.path.isfile(local_path):
            print(f"{local_path} is not a file.")
            continue
        caption = get_caption_for_one_image(local_path)
        if caption:
            print(f"Caption for {local_path}: {caption}")
            caption_file = os.path.splitext(local_path)[0] + ".txt"
            with open(caption_file, 'w') as f:
                f.write(caption + " [trigger]")
                print(f"Caption saved to {caption_file}")
        else:
            print(f"Failed to get caption for {local_path}")
