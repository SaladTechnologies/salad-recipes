# Flux Training

## Use AI Toolkit to train Flux1-Dev LoRAs

This recipe provides an example implementation for using [AI Toolkit](https://github.com/ostris/ai-toolkit) to train LoRA models for the [Flux1-Dev](https://huggingface.co/black-forest-labs/FLUX.1-dev) image generation model. Note that this model is [not licensed for commercial use](https://github.com/black-forest-labs/flux/blob/main/model_licenses/LICENSE-FLUX1-dev), so please ensure you have the appropriate rights to use it for your intended purpose.

- [Flux Training](#flux-training)
  - [Use AI Toolkit to train Flux1-Dev LoRAs](#use-ai-toolkit-to-train-flux1-dev-loras)
  - [Requirements](#requirements)
  - [Preparing Your Dataset](#preparing-your-dataset)
    - [Captioning Your Dataset](#captioning-your-dataset)
  - [Deploying Your Training Cluster](#deploying-your-training-cluster)
  - [Uploading Data And Queuing Jobs](#uploading-data-and-queuing-jobs)
  - [Monitoring the Job](#monitoring-the-job)
  - [Autoscaling](#autoscaling)
  - [Guide To Recipe Files](#guide-to-recipe-files)
    - [Dockerfiles](#dockerfiles)
    - [Scripts](#scripts)
    - [Config](#config)
  - [License](#license)

## Requirements

- Salad Cloud Account - [Sign up here](https://portal.salad.com/)
- S3-Compatible Storage - We're using [Cloudflare R2](https://www.cloudflare.com/products/r2/) in this example because it does not charge for egress, but you can use any S3-compatible storage solution.
- Python 3.10+

## Preparing Your Dataset

1. Create a folder inside the `data` directory named for a job id like `job-00001`.
2. Inside that folder, create a `dataset` folder and place your training images inside, along with a `.txt` file for each image that contains a caption for the image of the same name. For example, if you have an image named `image1.jpg`, you should have a file named `image1.txt` with the caption for that image.
3. Copy [this config file](https://github.com/ostris/ai-toolkit/blob/main/config/examples/train_lora_flux_24gb.yaml) to `data/job-00001/train.yaml` and make the following updates:
   - Update `.config.name` to your job id (e.g., `job-00001`).
   - Update `.config.datasets[0].folder_path` to `./dataset`
   - Update `.model.name_or_path` to `/model`, as the model weights are included in the docker image we will be using.
   - Update `.sample.prompts` to include the prompts you want to use for sampling. This is optional, but it can help you evaluate the quality of your model during training.
   - Update `.config.save.max_step_saves_to_keep` to `2` to save only the most recent progress checkpoint, plus one backup in case of file corruption.

The folder structure should look like this:

```text
data
└── job-00001
    ├── dataset
    │   ├── 00001.jpg
    │   ├── 00001.txt
    │   ├── 00002.jpg
    │   └── 00002.txt
    └── train.yml
```

### Captioning Your Dataset

If you don't have captions for your dataset, you can use any vision-language model to generate the captions. In this example we use OpenAI's GPT-4.1-Nano model, (their least expensive model) to generate captions for our dataset. You can use the `generate-captions.py` script to generate captions for your dataset. The script will take a folder of images and generate captions for each image using the GPT-4.1-Nano model. The generated captions will be saved in the same folder as the images with the same name as the image, but with a `.txt` extension. You will need your OpenAI API key to use this script. You can set the `OPENAI_API_KEY` environment variable to your OpenAI API key.

```bash
python generate-captions.py data/job-00001/dataset
```

## Deploying Your Training Cluster

Now that you have your dataset prepared, you can deploy your training cluster on SaladCloud. The docker image with the model weights included is quite large, and can take a while to download to a node and start running.

You can manually configure your container group in the portal, or do it with the API using the `container-group.json` file in this directory.

If deploying manually, make sure to set the following options:

- **Container Image**: `saladtechnologies/ai-toolkit:cuda12.8-flux1-dev-kelpie`
- **vCPU**: 4,
- **Memory**: 30GB
- **GPU**: RTX 5090
- **Storage**: 50GB
- **Environment Variables**:
  - `SALAD_PROJECT`: Your Salad project name.
  - AWS Credentials that can access your storage.

> Note this configuration costs $.496/hour/replica, plus any costs associated with your storage provider. In light testing, we found that a training job with 36 examples, 2000 training steps, and a batch size of 1 completed in just under an hour.

You can also deploy using the API. To do this, you will need to create a container group using the `container-group.json` file in this directory. Modify `container-group.json` with your environment variables. You can use the following command to create the container group:

```bash
curl -X POST \
  --url https://api.salad.com/api/public/organizations/{organization_name}/projects/{project_name}/containers \
  --header 'Content-Type: application/json' \
  --header 'Salad-Api-Key: <api-key>' \
  --data-binary @container-group.json
```

Make sure to replace `{organization_name}` and `{project_name}` with your organization and project names, and `<api-key>` with your Salad API key.

Note the `.id` of the container group in the response. This is the id of the container group that you will use to submit jobs to the Kelpie API. If you deployed using the portal, you can get the ID with the following curl command:

```bash
curl -X GET \
  --url https://api.salad.com/api/public/organizations/{organization_name}/projects/{project_name}/containers/{container_group_name} \
  --header 'Content-Type: application/json' \
  --header 'Salad-Api-Key: <api-key>'
```

This will return a JSON object with the details of the container group, including the `.id` field.

## Uploading Data And Queuing Jobs

While our container group warms up, we can upload our dataset to S3-compatible storage and queue jobs to the Kelpie API. The `prepare-and-queue-jobs.py` script will do this for you. Modify the script to include your salad org and project name. You will need appropriate AWS credentials to access your S3-compatible storage, as well as your Salad API Key set in the environment variable `SALAD_API_KEY`. See the [Kelpie Docs](https://kelpie.saladexamples.com/docs) for more information about the Kelpie API.

```bash
python prepare-and-queue-jobs.py \
  data \
  s3://my-bucket/some-prefix \
  $container_group_id
```

This will upload the dataset to your S3-compatible storage, and queue jobs to the Kelpie API. The script will also create a `kelpie_job.json` file in each job folder that contains the kelpie job id (different from your local job id, `job-00001`) and other information about the job.

You are encouraged to read the script to understand how it works, and how a kelpie job is structured.

Briefly, a kelpie job consists of a `command`, some `arguments`, optional `environment` variables, and a `sync` configuration. The `sync` configuration tells kelpie what to download before starting a job, what to upload while the job executes, and what to upload when the job completes. In our case, this looks like this:

- Before starting the job, kelpie will download the following files:
  - The training config file
  - The dataset folder
  - Any previously uploaded progress checkpoints
- While the job is running, kelpie will upload the following files:
  - The training progress checkpoints
  - Any images sampled during training
- When the job completes, kelpie will upload the following files:
  - The final model weights

## Monitoring the Job

You can monitor the job using the Kelpie API. You can use the following command to get the status of the job:

```bash
curl -X GET \
  --url https://kelpie.saladexamples.com/jobs/{job_id} \
  --header 'Content-Type: application/json' \
  --header 'Salad-Api-Key: <salad-api-key>' \
  --header 'Salad-Organization: <organization-name>' \
  --header 'Salad-Project: <project-name>'
```

Make sure to replace `{job_id}` with the job id of the kelpie job, and `<salad-api-key>` with your Salad API key.

This will return a JSON object with the details of the job, including the status, which machine had the job most recently, and how many heartbeats have been received.

You can also customize the `prepare-and-queue-jobs.py` script to include a webhook to be notified when the job completes.

## Autoscaling

Kelpie has an optional autoscaling feature that automates adjusting replica count based on the number of queued jobs, including scale-to-zero when the queue is empty. This feature works through the Salad API, and requires adding the Kelpie user to your Salad Organization to grant the required API access. Currently that is me (shawn.rushefsky@salad.com).

To enable autoscaling, you can submit a request to the Kelpie API to establish scaling rules for your container group.

```bash
curl -X POST \
  --url https://kelpie.saladexamples.com/scaling-rules \
  --header 'Content-Type: application/json' \
  --header 'Salad-Api-Key: <salad-api-key>' \
  --header 'Salad-Organization: <organization-name>' \
  --header 'Salad-Project: <project-name>' \
  --data '{
    "min_replicas": 0,
    "max_replicas": 10,
    "container_group_id": "<container-group-id>"
}'
```

Make sure to replace `<kelpie-api-key>` with your Kelpie API key, and `<container-group-id>` with the id of your container group.
This will create a scaling rule that will scale the container group to a minimum of 0 replicas and a maximum of 10 replicas. The scaling rules will be applied to all jobs submitted to the container group.

The Kelpie scaling algorithm works as follows:

- Every 5 minutes, all scaling rules are evaluated.
- The number of replicas in a container group is set to equal the number of queued or running jobs, up to the maximum number of replicas, and down to the minimum number of replicas.
- If the desired number of replicas is 0, the container group will be stopped.
- If the desired number of replicas is greater than 0 and the container group is not currently running, the container group will be started.

## Guide To Recipe Files

### Dockerfiles

This recipe is built in layers from several docker files.

- `Dockerfile.base`: This base image includes AI toolkit and all required dependencies.
- `Dockerfile.model`: This image includes the model weights and is built on top of the base image. A training job can be run from this image without the need to download the model weights again.
- `Dockerfile.dev`: This image is built on top of the model image, and includes a vscode server configured to run through [Dev Tunnels](https://docs.salad.com/tutorials/vscode-remote-development#vs-code-remote-tunnels) that will start as the main process in the container. You can connect to this tunnel from a web browser and use the vscode server to run commands in the container. This image is used for development and debugging, and is not required for training.
- `Dockerfile`: This image is built on top of the model image, and includes the [kelpie](https://github.com/SaladTechnologies/kelpie) job worker binary. This enables submitting batches of jobs to the Kelpie API, and having them distributed to the training cluster.

### Scripts

- `rename-files.sh`: This script renames the files in the dataset folder to be in the format `00001.jpg`, `00002.jpg`. This is not required.
- `generate-captions.py`: This script generates captions for the images in the dataset folder using the GPT-4.1-Nano model. This is not required, but it can help you generate captions for your dataset if you don't have them. You will need your OpenAI API key to use this script. You can set the `OPENAI_API_KEY` environment variable to your OpenAI API key.
- `prepare-and-queue-jobs.py`: This script loops through your data folder, and uploads the assets to S3 compatible storage, and queues the jobs to the Kelpie API. It will also create a `kelpie_job.json` file in each job folder that contains the kelpie job id (different from your local job id, `job-00001`) and other information about the job.
- `download-model.sh`: This script downloads the model weights from Hugging Face and saves them to the `model` folder. This is not required if you are using the docker image with the model weights included. You can run this script to download the model weights if you want to use them locally, or if you want to use a different model.

### Config

- `container-group.json`: This file contains the configuration for the container group that will be created in Salad Cloud. It includes the number of nodes, the type of nodes, and other configuration options. You can modify this file to change the configuration of your training cluster.
- `requirements.txt`: This file contains python requirements for running the scripts. It is not otherwise related to the training process.

## License

This recipe is licensed under the [MIT License](https://opensource.org/license/mit), as is the [AI Toolkit](https://github.com/ostris/ai-toolkit). However, the model weights for the Flux1-Dev model are [not licensed for commercial use](https://github.com/black-forest-labs/flux/blob/main/model_licenses/LICENSE-FLUX1-dev). Please ensure you have the appropriate rights to use the model for your intended purpose.