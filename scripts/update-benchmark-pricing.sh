#! /bin/bash

source scripts/salad-api.sh

org=${1:-"salad-benchmarking"}

if [ -z "$SALAD_API_KEY" ]; then
  echo "SALAD_API_KEY is not set"
  exit 1
fi

getAllPrices $org | jq . > scripts/prices.json