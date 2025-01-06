#! /usr/bin/bash

response_file=$1
output_dir=${2:-.}

if [ -z "$response_file" ]; then
  echo "Usage: ./parse_comfy_response <response_file>"
  exit 1
fi

mkdir -p $output_dir

# The file is json. There are fields filenames and images, both arrays. images are base64 encoded.
# we want to decode each image and save it to a file with the corresponding filename.
for i in $(jq -r '.filenames | .[]' $response_file); do
  index=$(jq -r '.filenames | index("'"$i"'")' $response_file)
  image=$(jq -r ".images[$index]" $response_file)
  echo $image | base64 -d > $output_dir/$i
done