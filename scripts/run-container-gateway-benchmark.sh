#!/bin/bash

set -e

usage="Usage: ./$0 "'--org <org> --project <project> --replicas <replicas> --recipe <recipe> [--container-group <container-group>] [--output <output>]

Options:
  --org <org>               The organization name
  --project <project>       The project name
  [--container-group <container-group>] The container group name. If not specified, it is assumed to be the same as the recipe name
  --replicas <replicas>     The number of replicas to start
  --recipe <recipe>         The recipe name
  [--output <output>]         The output file name (default: results.jsonl)
  [--benchmark <benchmark>] The benchmark file (default: benchmark.js)
'


# Parse command line arguments
benchmark_filename="benchmark.js"
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
  --recipe)
    shift
    recipe=$1
    ;;
  --output)
    shift
    output=$1
    ;;
  --benchmark)
    shift
    benchmark_filename=$1
    ;;
  *)
    echo $usage
    exit 1
    ;;
  esac
  shift
done

if [ -z "$org" ] || [ -z "$project" ]  || [ -z "$replicas" ] || [ -z "$recipe" ]; then
  echo $usage
  exit 1
fi

# Check that the SALAD_API_KEY environment variable is set
if [ -z "$SALAD_API_KEY" ]; then
  echo "Please set the SALAD_API_KEY environment variable"
  exit 1
fi

# Check that the recipe exists and has a benchmark file
benchmark_file="recipes/$recipe/benchmark/$benchmark_filename"
if [ ! -f "$benchmark_file" ]; then
  echo "Benchmark file $benchmark_file not found"
  exit 1
fi

# Load the salad api utility functions
source scripts/salad-api.sh

# benchmark name is the name of the benchmark file, no extension
benchmark_name=$(basename $benchmark_file | sed 's/\.js$//')
if [ -z "$output" ]; then
  output=$(dirname $benchmark_file)/$benchmark_name-results.jsonl
else
  output=$(dirname $benchmark_file)/$output
fi

node_count_output=$(echo $output | sed 's/\.jsonl$/-node-count.csv/')
test_config_output=$(echo $output | sed 's/\.jsonl$/-test-config.json/')
console_output=$(echo $output | sed 's/\.jsonl$/-console.txt/')

# If the container group is not specified, assume it is the same as the recipe name
if [ -z "$container_group" ]; then
  # Normalize recipe name to match container group name format
  container_group=$(echo $recipe | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')
  echo "Assuming Container Group: $container_group"
fi

export ACCESS_DOMAIN_NAME="https://$(getAccessDomainName $org $project $container_group)"
echo "Access domain name: $ACCESS_DOMAIN_NAME"

# Get the container group configuration and save it to a file
# This step lets us automatically derive the configuration and pricing for the container group,
# and it lets us verify that the configuration for testing was what we intended.
getContainerGroup $org $project $container_group | jq . > $test_config_output

# Start the container group and wait for the replicas to be ready
./scripts/start-container-group-and-wait-for-replicas --org $org --project $project --container-group $container_group --replicas $replicas

# Monitor the number of nodes in the container group in the background, outputting to a CSV file
nohup ./scripts/monitor-node-count --org $org --project $project --container-group $container_group --output $node_count_output &
monitor_pid=$!

trap "kill $monitor_pid" EXIT INT TERM

# Run the benchmark
k6 run --out json=$output --console-output $console_output $benchmark_file

# Stop the container group
stopContainerGroup $org $project $container_group
