#! /usr/bin/env bash

set -e

usage="Usage: ./$0 --org <org> --project <project> --container-group <container-group> --replicas <replicas>"

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
  --replicas)
    shift
    replicas=$1
    ;;
  *)
    echo $usage
    exit 1
    ;;
  esac
  shift
done

if [ -z "$org" ] || [ -z "$project" ] || [ -z "$container_group" ] || [ -z "$replicas" ]; then
  echo $usage
  exit 1
fi

if [ -z "$SALAD_API_KEY" ]; then
  echo "Please set the SALAD_API_KEY environment variable"
  exit 1
fi

source scripts/salad-api.sh

currentState=$(getCurrentStatus $org $project $container_group)
echo "Current state: $currentState"

# if it pending, poll until it's stopped, running, or failed
while [[ "$currentState" == "pending" ]]; do
  echo "Container group is pending. Waiting 10s..."
  sleep 10
  currentState=$(getCurrentStatus $org $project $container_group)
done

if [[ "$currentState" == "failed" ]]; then
  echo "Container group failed to create. See portal for more information"
  exit 1
fi

if [[ "$currentState" == "stopped" ]]; then
  echo "Container group is stopped. Starting..."
  startContainerGroup $org $project $container_group
fi

configuredReplicas=$(getConfiguredReplicas $org $project $container_group)
if [[ "$configuredReplicas" -lt "$replicas" ]]; then
  echo "Setting replicas to $replicas"
  setReplicas $org $project $container_group $replicas
fi

runningReplicas=$(getRunningReplicas $org $project $container_group)
while [[ "$runningReplicas" -lt "$replicas" ]]; do
  echo "$runningReplicas out of $replicas replicas running. Waiting 30s..."
  sleep 30
  runningReplicas=$(getRunningReplicas $org $project $container_group)
done

echo "All $replicas replicas are running"
