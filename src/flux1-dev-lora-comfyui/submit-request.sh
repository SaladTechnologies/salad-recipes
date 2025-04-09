#! /bin/bash

access_domain_name="http://localhost:3000"
payload_file="test-payload.json"

result=$(curl -X POST "$access_domain_name/workflow/fal-ai-flux-lora" \
  -H "Salad-Api-Key: $SALAD_API_KEY" \
  -H "Content-Type: application/json" \
  -d "@$payload_file")

# filename is the filename array
filename=$(echo "$result" | jq -r '.filenames[0]')

# the image is a base64 encoded string
echo $result | jq -r '.images[0]' | base64 -d > "$filename"
echo "Image saved as $filename"

# the prompt that got rendered from the input
prompt_id=$(echo "$result" | jq -r '.id')
echo $result | jq -r '.prompt' > "$prompt_id.json"