#!/bin/bash

access_domain_name="https://tahini-legume-7sg69hm73hxwud7b.salad.cloud"
export API_URL="$access_domain_name/workflow/sd1.5/txt2img"

k6 run --out json=results.jsonl benchmark.js