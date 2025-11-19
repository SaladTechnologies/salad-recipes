import json
import os
import sys

import requests

# Shared configuration with submit script
KELPIE_URL = "https://kelpie.saladexamples.com"
SALAD_API_KEY = os.getenv("SALAD_API_KEY", "")
SALAD_ORGANIZATION = os.getenv("SALAD_ORGANIZATION", "")
SALAD_PROJECT = os.getenv("SALAD_PROJECT", "")


def die(msg: str):
    print(f"[error] {msg}")
    sys.exit(1)


def build_headers():
    return {
        "Salad-Api-Key": SALAD_API_KEY,
        "Salad-Organization": SALAD_ORGANIZATION,
        "Salad-Project": SALAD_PROJECT,
    }


def fetch_job(job_id: str):
    url = f"{KELPIE_URL}/jobs/{job_id}"
    resp = requests.get(url, headers=build_headers(), timeout=30)
    if resp.status_code != 200:
        die(f"Kelpie returned {resp.status_code}: {resp.text[:400]}")
    return resp.json()


def main():
    job_id = os.getenv("JOB_ID") or (sys.argv[1] if len(sys.argv) > 1 else None)
    if not job_id:
        die("Usage: JOB_ID=<kelpie-job-id> python check_kelpie_job.py")

    data = fetch_job(job_id)
    print(json.dumps(data, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
