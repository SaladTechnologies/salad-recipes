#!/bin/bash

access_domain_name="https://tangelo-yam-rddgodpntpjivewa.salad.cloud"
export API_URL="$access_domain_name/workflow/sd3.5-large/txt2img"

k6 run --out json=results.jsonl benchmark.js