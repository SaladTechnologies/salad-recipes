#! /bin/bash

set -e

usage="Usage: ./$0 --org <org> --project <project> --container-group <container-group> --output <output>"

while [ "$1" != "" ]; do
  case $1 in
  --org)
    shift
    org=$1
    ;;
  --project)
    shift
    project=$1
    ;;
  --container-group)
    shift
    container_group=$1
    ;;
  --output)
    shift
    output=$1
    ;;
  *)
    echo $usage
    exit 1
    ;;
  esac
  shift
done

if [ -z "$org" ] || [ -z "$project" ] || [ -z "$container_group" ] || [ -z "$output" ]; then
  echo $usage
  exit 1
fi

if [ -z "$SALAD_API_KEY" ]; then
  echo "Please set the SALAD_API_KEY environment variable"
  exit 1
fi

source scripts/salad-api

# Reset the output file
echo "" > $output

# Loop until interrupted or the container group is stopped
while true; do
  currentState=$(getCurrentStatus $org $project $container_group)
  if [[ "$currentState" == "stopped" ]]; then
    echo "Container group stopped"
    exit 0
  fi

  # Get the number of running replicas
  runningReplicas=$(getRunningReplicas $org $project $container_group)
  currentTime=$(date +%s)
  echo "$currentTime,$runningReplicas" >> $output

  # Wait 30s before checking again
  sleep 30
done