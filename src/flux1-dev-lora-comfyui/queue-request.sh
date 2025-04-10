#! /bin/bash

usage="Usage: $0 <org> <project>"

if [ "$#" -ne 2 ]; then
  echo $usage
  exit 1
fi

org=$1
project=$2
queue_name="flux-lora-jobs"

source ../../scripts/salad-api

# Check for SALAD_API_KEY
if [ -z "$SALAD_API_KEY" ]; then
  echo "SALAD_API_KEY is not set. Please set it before running this script."
  exit 1
fi

prompt=$(cat "test-payload.json")
queue_job="{\"input\": $prompt}"

job=$(createJob $org $project $queue_name "$queue_job")
job_id=$(echo $job | jq -r '.id')

watchJob $org $project $queue_name $job_id 1