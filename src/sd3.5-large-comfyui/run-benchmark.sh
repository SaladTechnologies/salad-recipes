#!/bin/bash

# Create output directory
output_dir="benchmark-images"
mkdir -p $output_dir

export API_URL="https://tangelo-yam-rddgodpntpjivewa.salad.cloud/workflow/sd3.5-large/txt2img"

count=0
k6 run --out json=benchmark-results.json benchmark.js 2>&1 | while IFS= read -r line; do
  if echo "$line" | grep -q "IMAGE_DATA:"; then
    # Extract base64 data
    base64_data=$(echo "$line" |
      sed 's/.*IMAGE_DATA: \(.*\) \+source=console.*/\1/' |
      tr -cd '[A-Za-z0-9+/=]') # Only keep valid base64 characters

    count=$((count + 1))

    # Save to file
    echo "$base64_data" | base64 -d >"$output_dir/image_$count.png"
    echo "Saved image $count"
  fi
done
