#! /bin/bash

output_dir=${1:-output}
cat

while IFS= read -r line; do
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