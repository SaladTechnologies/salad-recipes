#!/bin/bash

################################################################################################
# Salad API Functions
#
# You should `source` this file to gain access to these functions. All of them accept the
# organization, project, and container group as the first three arguments.
#
# All of them require the SALAD_API_KEY environment variable to be set.
################################################################################################

function getCurrentStatus() {
  org=$1
  project=$2
  container_group=$3
  cg=$(getContainerGroup $org $project $container_group)
  status=$(echo $cg | jq -r '.current_state.status')
  echo $status
}

function startContainerGroup() {
  org=$1
  project=$2
  container_group=$3
  baseURL="https://api.salad.com/api/public/organizations/${org}/projects/${project}/containers/${container_group}"
  curl -s -X POST \
    -H "Salad-Api-Key: $SALAD_API_KEY" \
    $baseURL/start
}

function stopContainerGroup() {
  org=$1
  project=$2
  container_group=$3
  baseURL="https://api.salad.com/api/public/organizations/${org}/projects/${project}/containers/${container_group}"
  curl -s -X POST \
    -H "Salad-Api-Key: $SALAD_API_KEY" \
    $baseURL/stop
}

function getConfiguredReplicas() {
  org=$1
  project=$2
  container_group=$3
  cg=$(getContainerGroup $org $project $container_group)
  replicas=$(echo $cg | jq -r '.replicas')
  echo $replicas
}

function setReplicas() {
  org=$1
  project=$2
  container_group=$3
  replicas=$4
  baseURL="https://api.salad.com/api/public/organizations/${org}/projects/${project}/containers/${container_group}"
  cg=$(
    curl -s -X PATCH \
      -H "Salad-Api-Key: $SALAD_API_KEY" \
      -H "Content-Type: application/merge-patch+json" \
      -d "{\"replicas\": $replicas}" \
      $baseURL
  )
}

function getRunningReplicas() {
  org=$1
  project=$2
  container_group=$3
  cg=$(getContainerGroup $org $project $container_group)
  running=$(echo $cg | jq -r '.current_state.instance_status_counts.running_count')
  echo $running
}

function getAccessDomainName() {
  org=$1
  project=$2
  container_group=$3
  cg=$(getContainerGroup $org $project $container_group)
  dns=$(echo $cg | jq -r '.networking.dns')
  echo $dns
}

function getAllPrices() {
  org=$1
  baseURL="https://api.salad.com/api/public/organizations/${org}/gpu-classes"
  data=$(
    curl -s -X GET \
      -H "Salad-Api-Key: $SALAD_API_KEY" \
      $baseURL
  )
  echo $data
}

function getContainerGroup() {
  org=$1
  project=$2
  container_group=$3
  baseURL="https://api.salad.com/api/public/organizations/${org}/projects/${project}/containers/${container_group}"
  data=$(
    curl -s -X GET \
      -H "Salad-Api-Key: $SALAD_API_KEY" \
      $baseURL
  )
  if [ -z "$data" ]; then
    echo "Container group $container_group not found"
    exit 1
  fi
  echo $data
}

function createContainerGroup() {
  org=$1
  project=$2
  request_body=$3
  baseURL="https://api.salad.com/api/public/organizations/${org}/projects/${project}/containers"
  data=$(
    curl -s -X POST \
      -H "Salad-Api-Key: $SALAD_API_KEY" \
      -H "Content-Type: application/json" \
      -d "$request_body" \
      $baseURL
  )
  if [ -z "$data" ]; then
    echo "Failed to create container group"
    exit 1
  fi
  echo $data
}

function createQueue() {
  org=$1
  project=$2
  request_body=$3
  baseURL="https://api.salad.com/api/public/organizations/${org}/projects/${project}/queues"
  data=$(
    curl -s -X POST \
      -H "Salad-Api-Key: $SALAD_API_KEY" \
      -H "Content-Type: application/json" \
      -d "$request_body" \
      $baseURL
  )
  if [ -z "$data" ]; then
    echo "Failed to create queue"
    exit 1
  fi
  echo $data
}

function getQueue() {
  org=$1
  project=$2
  queue=$3
  baseURL="https://api.salad.com/api/public/organizations/${org}/projects/${project}/queues/${queue}"
  data=$(
    curl -s -X GET \
      -H "Salad-Api-Key: $SALAD_API_KEY" \
      $baseURL
  )
  if [ -z "$data" ]; then
    echo "Queue $queue not found"
    exit 1
  fi
  echo $data
}

function getJob() {
  org=$1
  project=$2
  queue_name=$3
  job_id=$4
  baseURL="https://api.salad.com/api/public/organizations/${org}/projects/${project}/queues/${queue_name}/jobs/${job_id}"
  data=$(
    curl -s -X GET \
      -H "Salad-Api-Key: $SALAD_API_KEY" \
      $baseURL
  )
  if [ -z "$data" ]; then
    echo "Job $job_id not found"
    exit 1
  fi
  echo $data
}

function createJob() {
  org=$1
  project=$2
  queue_name=$3
  request_body=$4
  baseURL="https://api.salad.com/api/public/organizations/${org}/projects/${project}/queues/${queue_name}/jobs"
  data=$(
    curl -s -X POST \
      -H "Salad-Api-Key: $SALAD_API_KEY" \
      -H "Content-Type: application/json" \
      -d "$request_body" \
      $baseURL
  )
  if [ -z "$data" ]; then
    echo "Failed to create job"
    exit 1
  fi
  echo $data
}

function watchJob() {
  org=$1
  project=$2
  queue_name=$3
  job_id=$4
  interval=${5:-5}
  while true; do
    job=$(getJob $org $project $queue_name $job_id)
    clear
    echo "Job ID: $job_id"
    echo "Timestamp: $(date --utc)"
    status=$(echo $job | jq -r '.status')
    if [ "$status" == "succeeded" ]; then
      echo "Job succeeded."
      break
    elif [ "$status" == "failed" ]; then
      echo "Job failed. Exiting."
      exit 1
    elif [ "$status" == "cancelled" ]; then
      echo "Job cancelled. Exiting."
      exit 1
    fi
    echo "Job status: $status"
    echo $job | jq '.events'
    sleep $interval
  done
  echo $job | jq ".output" > "job-$job_id-output.json"
  echo $job | jq ".output"
}
