# Mistral 7b on TGI

## TGI (Text Generation Interface) by Hugging Face

TGI (Text Generation Inference): A highly optimized and efficient serving system for large language models (LLMs) designed for high-throughput text generation tasks. TGI allows running large models like Mistral-7B in production environments with low latency and optimized memory usage.

## mistralai/Mistral-7B-Instruct-v0.3 

A powerful instruction-tuned model from the Mistral family, designed for a wide range of NLP tasks. With 7 billion parameters, it offers state-of-the-art performance in understanding and generating human-like text based on instructions provided.


## What This Recipe Does

This recipe creates a TGI server running mistralai/Mistral-7B-Instruct-v0.3

## How To Use This Recipe

As a core image of this recipe we use  TGI (Text Generation Inference) Docker image from Hugging Face: ghcr.io/huggingface/text-generation-inference:2.1.1

### Hugging Face Hub Token
You will need to pass your Hugging Face Hub Token when using this image. You can generate or retrieve your token from your Hugging Face account settings at:
[Hugging Face Tokens](https://huggingface.co/settings/tokens).

### Changing the Model

By default, we use the Mistral-7B-Instruct-v0.3 model. You can specify the model to be used by passing the following environment variable in the container group: 
```bash
"MODEL_ID": "mistralai/Mistral-7B-Instruct-v0.3" 
```
You can also change to any other supported models by updating this variable. Here is a list of supported models: [Hugging Face Supported Models](https://huggingface.co/docs/text-generation-inference/supported_models).

### Container Group Definition

To deploy the container-group, you must provide the following environment variables:

```json
"environment_variables": {
    "MODEL_ID": "mistralai/Mistral-7B-Instruct-v0.3",
    "PORT": "3000",
    "HOSTNAME": "::",
    "HUGGING_FACE_HUB_TOKEN": ""
}
```

You can find the full container group definition for this setup [here](container-group.json)

Make sure to configure the container group to align with your deployment environment and to include your Hugging Face token for proper authentication.


### Authentication
This API does not require authentication by default, but authentication can be enabled by using the container gateway. If authentication is enabled, all requests will need to include your Salad API key in the header (Salad-Api-Key). For more details about authentication, please refer to the Salad 

### Replica Count
By default, this recipe is configured for 3 replicas. We recommend using at least 3 nodes to ensure uptime and availability. Salad’s distributed GPU cloud is powered by idle gaming PCs, which can be interrupted without warning (e.g., when the machine is used for gaming). To mitigate interruptions, consider over-provisioning your resources slightly beyond your expected needs.

### Logging
Logs can be viewed directly from the Salad portal during testing and development phases. For production workloads, you can integrate an external logging solution, such as Axiom, during the container group creation process for real-time log monitoring.

### Deploy It And Wait
Once deployed, Salad will allocate the appropriate nodes, and the container image download will begin. Depending on network conditions, downloading the image may take a few minutes. Once the nodes are running, you will see a green checkmark in the “Ready” column, indicating that the API is ready to handle traffic. Although the API can serve traffic when a single instance is running, we recommend waiting until multiple nodes are active for production scenarios.

## How To Send Requests

Once your TGI server is running with the Mistral-7B-Instruct-v0.3 model, you can send requests to interact with the model. Follow the instructions provided in the [OpenAI Documentation](openai.md) file to learn how to properly structure and send requests to the API.

Example requests and usage scenarios are available in the [OpenAI Documentation](openai.md) file for your reference.

## Workload Customizations

### Hardware Considerations
For optimal performance, we recommend using a GPU with at least 24GB VRAM to run TGI efficiently. 

### Custom Models

To switch the model follow instructions above

### Scaling for Production
For production, we recommend setting the replica count to 5 or more to ensure coverage in case of node interruptions. Salad’s infrastructure ensures that your workloads are distributed across multiple GPU nodes, and interruptions are handled smoothly.

### Default Configuration
Hardware: GPU with 24GB VRAM
System RAM: 8 GB
vCPU: 8 vCPUs