# Llama 3.1-8b with Ollama

## Ollama

Ollama is a toolkit for deploying and service Large Language Models (LLMs). Ollama enables local operation of open-source large language models like Llama 3.1, simplifying setup and configuration, including GPU usage, and providing a library of supported models.

## Llama 3.1 

The Llama 3.1 8B model is part of Meta's latest Llama 3.1 family, designed to offer enhanced multilingual support and significantly improved reasoning capabilities. With a context length of 128K, this model is ideal for handling complex tasks such as long-form text summarization, conversational AI, and coding assistance. Despite being a smaller model in the Llama family, the 8B version stands out for its ability to perform at a high level in tasks requiring tool use, general knowledge, and strong reasoning.

Llama 3.1 has been rigorously evaluated across 150 benchmark datasets and has undergone human evaluations, comparing favorably against top-tier models like GPT-4 and Claude 3.5 Sonnet. These evaluations highlight the model's effectiveness in multilingual tasks, steerability, and real-world scenarios.

![Llama 3.1 Evaluation](https://ollama.com/assets/mchiang0610/mikey3.1/ad042a1c-bbc7-47de-bbbf-78a3cfc13485)


## What This Recipe Does

This recipe creates an Ollama server running the Llama 3.1 8B model.

## Key Features
- `Ollama:` A llm server that allows you to deploy LLM models like Llama 3.1.
- `Llama 3.1 8B:` A state-of-the-art large language model (LLM) designed for efficient inference and capable of handling various natural language processing tasks. 

## How To Use This Recipe


### Authentication
This API does not require authentication by default, but authentication can be enabled by using the container gateway. If authentication is enabled, all requests will need to include your Salad API key in the header (Salad-Api-Key). For more details about authentication, please refer to the Salad 

### Replica Count
By default, this recipe is configured for 3 replicas. We recommend using at least 3 nodes to ensure uptime and availability. Salad’s distributed GPU cloud is powered by idle gaming PCs, which can be interrupted without warning (e.g., when the machine is used for gaming). To mitigate interruptions, consider over-provisioning your resources slightly beyond your expected needs.

### Logging
Logs can be viewed directly from the Salad portal during testing and development phases. For production workloads, you can integrate an external logging solution, such as Axiom, during the container group creation process for real-time log monitoring.

### Deploy It And Wait
Once deployed, Salad will allocate the appropriate nodes, and the container image download will begin. Depending on network conditions, downloading the image may take a few minutes. Once the nodes are running, you will see a green checkmark in the “Ready” column, indicating that the API is ready to handle traffic. Although the API can serve traffic when a single instance is running, we recommend waiting until multiple nodes are active for production scenarios.

## How To Send Requests

Once your Ollama server is running with the Llama 3.1 8B model, you can send requests to interact with the model. Follow the instructions provided in the [OpenAI Documentation](openai.md) file to learn how to properly structure and send requests to the API.

Example requests and usage scenarios are available in the [OpenAI Documentation](openai.md) file for your reference.

## Workload Customizations

### Hardware Considerations
For optimal performance, we recommend using a GPU with at least 8GB VRAM running Ollama. If you need faster responses, consider upgrading to a GPU with higher VRAM.

### Custom Models

By default, we use Llama 3.1. You can also run any other model from the [Ollama library](https://ollama.com/library?sort=popular)

You have 2 options on how to change the model: 

- `Preloading Custom Models:` - If you want the model to be preloaded into the image, you need to fork this Git repo, upload the model into the .ollama folder in the ollama-llama3.1 directory, and update run.sh by replacing llama3.1:8b:

```bash
MODEL=${MODEL:-llama3.1:8b}
```
with the model you want to use. You will also need to specify the new model in your requests sent to the server.

- `Loading Models During Startup` - If you do not want the model to be preloaded, you can simply update run.sh, and the model will be loaded during the server's startup. However, this will increase the cold start time. Make sure that your startup probe is configured to allow the server time to load the model.

Make sure to save your new image into a container registry and update container image in your [container group](https://docs.salad.com/container-engine/containers)

### Scaling for Production
For production, we recommend setting the replica count to 5 or more to ensure coverage in case of node interruptions. Salad’s infrastructure ensures that your workloads are distributed across multiple GPU nodes, and interruptions are handled smoothly.

### Default Configuration
Hardware: RTX 3060 with 8GB VRAM
System RAM: 8 GB
vCPU: 8 vCPUs