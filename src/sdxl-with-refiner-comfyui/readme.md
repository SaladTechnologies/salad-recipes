# Stable Diffusion XL with Refiner - ComfyUI (API)

## What This Recipe Does

This recipe creates an inference API for [Stable Diffusion XL](https://www.notion.so/SDXL-with-Refiner-ComfyUI-Recipe-Documentation-0335076da4e441a5b95e84349f86a152?pvs=21), an image generation model by Stability AI.
It includes the base and [refiner model](https://huggingface.co/stabilityai/stable-diffusion-xl-refiner-1.0).
Inference is powered by [ComfyUI](https://github.com/comfyanonymous/ComfyUI/), exposed via [a simple HTTP API](https://github.com/SaladTechnologies/comfyui-api) to facilitate scalable stateless operation.
Users can make an HTTP request to the provided endpoints and get back one or more images in base64 encoded form.
Optionally, users can receive completed images via a webhook.

Stable Diffusion XL is notable for a number of reasons:

- High quality images achieved through a multi-model workflow
- Supports many different art styles
- Commercial-friendly license

### Example Output

![](images/sdxl-image-1.png)

![](images/sdxl-image-2.png)

![](images/sdxl-image-3.png)

![](images/sdxl-image-4.png)

```bash
curl -X 'POST' \
  "$access_domain_name/workflow/sdxl/txt2img-with-refiner" \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "input": {
    "prompt": "8-bit classic video game art of a salad",
    "negative_prompt": "text, watermark, hands",
    "steps": 25,
    "cfg_scale": 9,
    "sampler_name": "euler",
    "scheduler": "normal",
    "base_start_step": 0,
    "base_end_step": 20,
    "refiner_start_step": 20
  }
}' | jq -r '.images[0]' | base64 -d > image.png
```

## How To Use This Recipe

### Authentication

When deploying this recipe, you can optionally enable authentication in the container gateway.
If you enable authentication, all requests to your API will need to include your Salad API key in the header `Salad-Api-Key`.
See the [documentation](https://docs.salad.com/container-engine/gateway/sending-requests#authenticated-requests) for more information about authentication.

### Replica Count

The recipe is configured for 3 replicas by default, and we recommend using at least 3 for testing, and at least 5 for production workloads.
Salad’s distributed GPU cloud is powered by idle gaming PCs around the world, in private residences, gaming cafes, and esports arenas.
A consequence of this unique infrastructure is that all nodes must be considered interruptible without warning.
If a Chef (a compute host) decides they want to use their GPU to play a video game, or their dog trips on the power cord, or their Wi-Fi goes out, the instance of your workload running on that node will be interrupted, and a new instance will be allocated to a different node.
This means you will want to slightly over-provision the capacity you expect to need in order to have adequate coverage during node reallocations.
Don’t worry, we only charge for instances that are actually running.

### Logging

Salad offers a simple built-in method to view logs from the portal, to facilitate testing and development.
For production workloads, we highly recommend connecting an external logging source, such as Axiom.
This can be done during container group creation.

### Deploy It And Wait

When you deploy the recipe, Salad will find the desired number of qualified nodes, and begin the process of downloading the container image to the host machine.
This particular image is quite large (~15 GB), and it may take up to tens of minutes to download to some machines, depending on the network conditions of that particular node.
Remember, these are residential PCs with residential internet connections, and performance will vary across different nodes.

Eventually, you will see instances enter the running state, and show a green checkmark in the “Ready” column, indicating the workload is passing its readiness probe.
Once at least 1 instance is running, the container group will be considered running, but for production you will want to wait until an adequate number of nodes have become ready before moving traffic over.

![](images/deploy-sdxl-1.png)

### Visit The Docs

Once at least one instance is running, you can navigate to the `/docs` endpoint at the Access Domain Name provided in the portal.
In the above example that URL is `https://vinegar-garden-tnar18sx3xz0n4st.salad.cloud/docs` .
You’ll see the swagger documentation that looks something like this:

![](images/sdxl-docs.png)

### API Endpoints

- `GET /health` - A healthcheck endpoint that indicates whether the server is up and warm.
This is used as our startup probe.
- `GET /ready` - A readiness endpoint that indicates whether the server is warm and ready to receive traffic.
This is used as our readiness probe.
- `GET /models` - Conveniently see what models are available.
- `POST /prompt` - This accepts a ComfyUI prompt in the API format.
This endpoint offers you the full flexibility of ComfyUI, as you can submit any valid json workflow.
For `LoadImage` nodes, you can include either a URL, or a Base64-encoded image as the image value.
- `POST /workflow/sdxl/txt2img` - This is a convenience endpoint that lets you submit as little as just the prompt and get an image back, without worrying about the complexities of the ComfyUI prompt workflow format.
- `POST /workflow/sdxl/img2img` - This is a convenience endpoint that lets you submit an img2img request using as little as the prompt and an image.
The image can be provided as either a URL or a Base64-encoded image.
- `POST /workflow/sdxl/txt2img-with-refiner` - This is a convenience endpoint that lets you customize the number of steps performed by the base and refiner models.

## Workload Customizations

### Hardware Considerations

We recommend at least 24gb of system ram for this workload, with 30gb preferred.
We also recommend a 24gb vRAM GPU if you are using the refiner model.
You can use a 16gb vRAM GPU if you are only using the base model.
Our default configuration uses an RTX 4090 with 24gb vRAM, 30gb system RAM, and 4 vCPU.
You should conduct your own performance testing for your specific workload and hardware configuration.

### Custom Models And Nodes

To use a different model, you would follow [this guide](https://docs.salad.com/container-engine/guides/stable-diffusion/basic-how-to-deploy-stable-diffusion-on-salad-comfy) but copy in your custom sdxl model(s) instead of the default one, and ensure your warmup workflow references the correct checkpoint name.
You’d push up the new image to the image registry of your choice, and edit the container group to reference the new image.

### Custom Endpoints

To add custom endpoints or other custom functionality to the API server, you will need to make some small customizations to the API executable.
To do this, you can [fork the repo](https://github.com/SaladTechnologies/comfyui-api/fork) and [learn how to add custom workflows](https://github.com/SaladTechnologies/comfyui-api?tab=readme-ov-file#generating-new-workflow-template-endpoints).

## Performance

**(Default Configuration) RTX 4090 24GB vRAM, 30GB System RAM, 4 vCPU**

We used Postman to [test the performance](https://blog.postman.com/postman-api-performance-testing/) of this recipe.
Each test request generated 1 image at 1024x1024 resolution, using 20 steps in the base model, and 5 steps in the refiner model.
We had 5 salad instances running for the benchmark, and simulated load from 5 simultaneous users for 5 minutes.

![](images/sdxl-performance-5vu.png)


We can see the average total request time is about **4.77 seconds**, and that performance was relatively consistent, and **no errors** were encountered.
We saw throughput of **0.84 requests / second**.

We ran a second test with 8 simulated users on the same 5 instances.
We see average total request time is up a bit at about **5.84 seconds (+22.4%)**.
However, we also see that throughput is up to **1.13 requests / second (+34.5%)**, and error rate remained at **0**.

![](images/sdxl-performance-8vu.png)

You should conduct your own performance testing to find the right balance for your users and your budget.

## API Reference

You can see the full API documentation at the `/docs` endpoint at the Access Domain Name of your container group.

### `POST /workflow/sdxl/txt2img-with-refiner` - Create An Image

**Request**

```shell
curl -X 'POST' \
  "$access_domain_name/workflow/sdxl/txt2img-with-refiner" \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "input": {
    "prompt": "vivid watercolor painting of a tropical beach, stunning, beautiful",
    "negative_prompt": "text, watermark, hands",
    "steps": 25,
    "cfg_scale": 9,
    "sampler_name": "euler",
    "scheduler": "normal",
    "base_start_step": 0,
    "base_end_step": 20,
    "refiner_start_step": 20
  }
}'
```

**Response**

```json
{
  "id": "3b0efe38-4d06-470e-88aa-9f891c193398",
  "input": {
    "prompt": "vivid watercolor painting of a tropical beach, stunning, beautiful",
    "negative_prompt": "text, watermark, hands",
    "width": 1024,
    "height": 1024,
    "seed": 529013063261855,
    "steps": 25,
    "cfg_scale": 9,
    "sampler_name": "euler",
    "scheduler": "normal",
    "base_start_step": 0,
    "base_end_step": 20,
    "refiner_start_step": 20,
    "checkpoint": "sd_xl_base_1.0.safetensors",
    "refiner_checkpoint": "sd_xl_refiner_1.0.safetensors"
  },
  "prompt": {...},
  "images": ["base64image"]
}
```

Your generated image will be a base64-encoded string at `.images[0]` in the response body.

![](images/sdxl-image-5.png)