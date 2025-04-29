import os
import requests
import sys
import boto3
import json
import threading


kelpie_api_key = os.getenv("KELPIE_API_KEY")
kelpie_base_url = os.getenv("KELPIE_API_URL")
usage = f"Usage: python {sys.argv[0]} <data-directory> <s3-url> <container-group-id>"
example = f"Example: python {sys.argv[0]} /path/to/data-directory s3://my-training-data/batch0001/ 97fe1413-0989-4d70-8bbb-426219001dd2"
if len(sys.argv) != 4:
    print(usage)
    print(example)
    sys.exit(1)
data_directory = sys.argv[1]
if not os.path.isdir(data_directory):
    print(f"{data_directory} is not a directory.")
    sys.exit(1)
s3_url = sys.argv[2]
container_group_id = sys.argv[3]

s3 = boto3.client("s3")
bucket_name = s3_url.split("/")[2]
prefix = "/".join(s3_url.split("/")[3:])


def get_all_jobs(directory: str):
    """
    Get all jobs in the directory. Within the provided directory, each directory is named with a job id.
    Each job directory contains a directory called "dataset", and a file called "train.yml"
    """
    for job_id in os.listdir(directory):
        job_directory = os.path.join(directory, job_id)
        if not os.path.isdir(job_directory):
            continue
        dataset_directory = os.path.join(job_directory, "dataset")
        if not os.path.isdir(dataset_directory):
            continue
        train_yml_file = os.path.join(job_directory, "train.yml")
        if not os.path.isfile(train_yml_file):
            continue
        yield {
            "job_id": job_id,
            "dataset_directory": dataset_directory,
            "train_yml_file": train_yml_file
        }


def upload_one_job_to_s3(job: dict, s3_url: str):
    """
    Upload the job to S3. The job is a dictionary with the following keys:
    - job_id: the id of the job
    - dataset_directory: the directory containing the dataset. There are no subdirectories in this directory.
    - train_yml_file: the file containing the train.yml file
    """
    job_id = job["job_id"]
    dataset_directory = job["dataset_directory"]
    train_yml_file = job["train_yml_file"]
    print(f"Uploading {job_id} to {s3_url}/{job_id}/")
    # Upload the dataset directory to S3
    uploads = []
    for filename in os.listdir(dataset_directory):
        file_path = os.path.join(dataset_directory, filename)
        if not os.path.isfile(file_path):
            continue
        thread = threading.Thread(target=s3.upload_file,
                                  args=(file_path, bucket_name,
                                        f"{prefix}/{job_id}/dataset/{filename}"))
        thread.start()
        uploads.append(thread)
    thread = threading.Thread(target=s3.upload_file,
                              args=(train_yml_file, bucket_name,
                                    f"{prefix}/{job_id}/config/train.yml"))
    thread.start()
    uploads.append(thread)
    # Wait for all uploads to finish
    print(f"Waiting for {len(uploads)} uploads to finish...")
    for thread in uploads:
        thread.join()


def queue_job_in_kelpie(job_id: str):
    """
    Queue the job in Kelpie.
    """
    url = os.path.join(kelpie_base_url, "jobs")
    headers = {
        "X-Kelpie-Key": kelpie_api_key,
        "Content-Type": "application/json"
    }
    data = {
        # In Kelpie, jobs are assigned to a container group
        "container_group_id": container_group_id,

        # The command our job will run is `python run.py training-config/train.yml`
        "command": "python",
        "arguments": [
            "run.py",
            "training-config/train.yml"
        ],

        # Data persistence is a feature of Kelpie that allows you to sync files
        # between the job and S3. This is useful for downloading the dataset
        # and uploading the output files.
        "sync": {
            # The `before` block defines all files to be downloaded before the job starts
            "before": [
                # We need the dataset of images and text files
                {
                    "bucket": bucket_name,
                    "prefix": f"{prefix}/{job_id}/dataset/",
                    "local_path": "dataset/",
                    "direction": "download"
                },

                # We need the train.yml file to define the training parameters
                {
                    "bucket": bucket_name,
                    "prefix": f"{prefix}/{job_id}/config/",
                    "local_path": "training-config/",
                    "direction": "download"
                },

                # Progress checkpoints are saved in the output directory, so we
                # need to download the output directory as well, so the job can be resumed
                # if it was previously interrupted
                {
                    "bucket": bucket_name,
                    "prefix": f"{prefix}/{job_id}/output/",
                    "local_path": f"output/{job_id}/",
                    "direction": "download"
                }],

            # The `during` block defines all files to be uploaded during the job
            "during": [
                # The output directory is where the model checkpoints are saved
                # and where the model is saved at the end of the job
                {
                    "bucket": bucket_name,
                    "prefix": f"{prefix}/{job_id}/output/",
                    "local_path": f"output/{job_id}/",
                    "direction": "upload"
                }],

            # The `after` block defines all files to be uploaded after the job finishes
            "after": [
                # The final model is saved in the output directory as a .safetensors file
                # named with the job id
                {
                    "bucket": bucket_name,
                    "prefix": f"{prefix}/{job_id}/output/",
                    "local_path": f"output/{job_id}/",
                    "direction": "upload",
                    "pattern": f"{job_id}\.safetensors"
                }]
        }
    }
    response = requests.post(url, headers=headers, json=data)
    if response.status_code == 202:
        body = response.json()
        return body
    else:
        print(f"Error: {response.status_code} - {response.text}")
        return None


if __name__ == "__main__":
    print(f"Uploading jobs from {data_directory} to {s3_url}")
    print(f"Container group id: {container_group_id}")
    for job in get_all_jobs(data_directory):
        upload_one_job_to_s3(job, s3_url)
        response = queue_job_in_kelpie(job["job_id"])
        if response:
            with open(os.path.join(data_directory, job["job_id"], "kelpie_job.json"), "w") as f:
                json.dump(response, f, indent=2)
        else:
            print(f"Failed to queue job {job['id']} in Kelpie")
