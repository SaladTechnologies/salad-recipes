#! /bin/bash
set -e

usage="Usage: $0 <org> <project>"

if [ "$#" -ne 2 ]; then
  echo $usage
  exit 1
fi

org=$1
project=$2

# Check for SALAD_API_KEY
if [ -z "$SALAD_API_KEY" ]; then
  echo "SALAD_API_KEY is not set. Please set it before running this script."
  exit 1
fi

source ../../scripts/salad-api

container_group_def=$(cat "container-group-with-queue.json")
container_group_name=$(echo $container_group_def | jq -r '.name')
queue_name=$(echo $container_group_def | jq -r '.queue_connection.queue_name')

# if queue_name is not set or is null, exit
if [ -z "$queue_name" ] || [ "$queue_name" == "null" ]; then
  echo "queue_name is not set or is null. Please check the container group definition."
  exit 1
fi

queue=$(getQueue $org $project $queue_name)


# If the response does not have .name, then the queue does not exist
if ! echo "$queue" | jq -e 'has("name")' > /dev/null; then
  echo "Queue $queue_name does not exist. Creating it..."
  createQueue $org $project "{\"name\": \"$queue_name\"}"
else
  echo "Queue $queue_name already exists."
fi

container_group=$(getContainerGroup $org $project $container_group_name)
# If the response does not have .name, then the container group does not exist
if ! echo "$container_group" | jq -e 'has("name")' > /dev/null; then
  echo "Container group $container_group_name does not exist. Creating it..."
  createContainerGroup $org $project "$container_group_def"
else
  echo "Container group $container_group_name already exists."
fi