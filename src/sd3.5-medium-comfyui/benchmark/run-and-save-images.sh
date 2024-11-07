#!/bin/bash

# Create output directory
output_dir="images"
mkdir -p $output_dir

access_domain_name="https://tamarillo-french-3ao6q775j19izeke.salad.cloud"
export API_URL="$access_domain_name/workflow/sd3.5-medium/txt2img"
export SAVE_IMAGES=true

count=0
k6 run --out json=results.json benchmark.js 2>&1 | while IFS= read -r line; do
  if echo "$line" | grep -q "IMAGE_DATA:"; then
    # Our benchmark script logs the generated images in base64 format
    # that we can extract and save to a file
    base64_data=$(echo "$line" |
      sed 's/.*IMAGE_DATA: \(.*\) \+source=console.*/\1/' |
      tr -cd '[A-Za-z0-9+/=]') # Only keep valid base64 characters

    count=$((count + 1))

    # Save to file
    echo "$base64_data" | base64 -d >"$output_dir/image_$count.png"
    echo "Saved image $count"
  fi
done
