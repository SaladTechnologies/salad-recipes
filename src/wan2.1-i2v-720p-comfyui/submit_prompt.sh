#! /bin/bash

usage="Usage: $0 <org> <project>"

if [ "$#" -ne 2 ]; then
  echo $usage
  exit 1
fi

org=$1
project=$2

source ../../scripts/salad-api

# Check for SALAD_API_KEY
if [ -z "$SALAD_API_KEY" ]; then
  echo "SALAD_API_KEY is not set. Please set it before running this script."
  exit 1
fi

container_group_def=$(cat "container-group.json")
queue_name=$(echo $container_group_def | jq -r '.queue_connection.queue_name')
prompt=$(cat "prompt.json")
queue_job="{\"input\": $prompt}"

# job=$(createJob $org $project $queue_name "$queue_job")
# job_id=$(echo $job | jq -r '.id')
job_id="e1d629b5-37ea-4ce8-8e0d-c7b4240ebe09"

watchJob $org $project $queue_name $job_id