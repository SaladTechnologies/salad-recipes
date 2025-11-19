import sys, uuid, time, requests, json, os

# --------- Replace these with your real values ----------
KELPIE_URL = "https://kelpie.saladexamples.com"
SALAD_API_KEY = os.getenv("SALAD_API_KEY", "")
SALAD_ORGANIZATION = os.getenv("SALAD_ORGANIZATION", "")
SALAD_PROJECT = os.getenv("SALAD_PROJECT", "")
CONTAINER_GROUP_ID = os.getenv("CONTAINER_GROUP_ID", "")
BUCKET_NAME = os.getenv("BUCKET_NAME", "")
# --------------------------------------------------------

def build_headers():
    return {
        "Salad-Api-Key": SALAD_API_KEY,
        "Salad-Organization": SALAD_ORGANIZATION,
        "Salad-Project": SALAD_PROJECT,
        "Content-Type": "application/json"
    }

def build_sync(job_id: str):
    return {
        "before": [],
        "during": [],
        "after": [
            {
                "bucket": BUCKET_NAME,
                "prefix": f"hello-world/{job_id}",
                "local_path": "/opt/results/",
                "direction": "upload",
            }
        ],
    }


def build_payload(job_id: str):
    run_script = " && ".join(
        [
            "set -euo pipefail",
            "mkdir -p /opt/results",
            "cd /opt/risc0/examples/hello-world",
            "RUSTFLAGS=\"-C target-cpu=native\" cargo run -F cuda --release |& tee /opt/results/hello_world.log",
        ]
    )
    return {
        "container_group_id": CONTAINER_GROUP_ID,
        "command": "bash",
        "arguments": ["-lc", run_script],
        "environment": {},
        "sync": build_sync(job_id),
    }

def poll_job(kelpie_id: str):
    headers = build_headers()
    while True:
        time.sleep(5)
        sr = requests.get(f"{KELPIE_URL}/jobs/{kelpie_id}", headers=headers, timeout=15)
        if sr.status_code != 200:
            print(f"[poll][warn] status={sr.status_code} body={sr.text[:160]}")
            continue
        body = sr.json()
        st = body.get("status")
        print(f"[poll] status={st}")
        if st in ("succeeded", "failed", "cancelled"):
            print(f"[done] final_status={st}")
            return st

def submit(job_id: str, poll: bool):
    payload = build_payload(job_id)
    headers = build_headers()
    print(f"[submit] job_id={job_id}")
    r = requests.post(f"{KELPIE_URL}/jobs", headers=headers, json=payload, timeout=45)
    if r.status_code not in (200, 202):
        print(f"[error] Kelpie reject ({r.status_code}): {r.text[:400]}")
        sys.exit(1)
    data = r.json()
    kelpie_id = data.get("id")
    print(f"[submit] kelpie_job_id={kelpie_id}")
    print(f"[submit] outputs => s3://{BUCKET_NAME}/hello-world/{job_id}/ (after completion)")
    if poll and kelpie_id:
        poll_job(kelpie_id)

def main():
    poll = os.getenv("POLL", "0") not in ("0", "false", "False")
    job_id = f"job-{uuid.uuid4().hex[:8]}"
    submit(job_id, poll=poll)

if __name__ == "__main__":
    main()
