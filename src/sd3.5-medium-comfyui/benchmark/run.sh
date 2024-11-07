#!/bin/bash

access_domain_name="https://tamarillo-french-3ao6q775j19izeke.salad.cloud"
export API_URL="$access_domain_name/workflow/sd3.5-medium/txt2img"

k6 run --out json=results.jsonl benchmark.js