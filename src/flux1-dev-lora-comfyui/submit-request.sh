#! /bin/bash

access_domain_name="http://localhost:3000"
endpoint="/workflow/fal-ai-flux-lora"
payload_file="test-payload.json"

result=$(curl -X POST "$access_domain_name$endpoint" \
  -H "Content-Type: application/json" \
  -d "@$payload_file")
filename=$(echo "$result" | jq -r '.filenames[0]')
echo $result | jq -r '.images[0]' | base64 -d > "$filename"
echo "Image saved as $filename"
prompt_id=$(echo "$result" | jq -r '.id')
echo $result | jq -r '.prompt' > "$prompt_id.json"