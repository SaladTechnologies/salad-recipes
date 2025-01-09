# ComfyUI Base Image

This directory contains the dockerfile for the base image for ComfyUI recipes.
It includes:

- [ComfyUI](https://github.com/comfyanonymous/ComfyUI/), a powerful node-based interface for constructing and executing image generation workflows.
- The [ComfyUI CLI](https://github.com/Comfy-Org/comfy-cli) for easy node management.
- The [ComfyUI API](https://github.com/SaladTechnologies/comfyui-api) to provide a stateless backend for your app.
- PyTorch 2.5.0
- CUDA 12.1
- wget, curl, git, unzip, pip

## Tags

Tags follow the pattern `comfy<comfy-version>-api<api-version>-base[-devel]`.
The `devel` tag is built from the `devel` pytorch images, rather than the `runtime` images.
These images are quite a lot larger, but have the full cuda toolkit, which is required for some workflows and extensions.

## Build

To build the image, run the following from this directory:

```bash
# Add --devel to build the devel image
./build --comfy 0.3.10 --api 1.7.0
```

## Run

To run the image, run the following:

```bash
# Add --devel to run the devel image
./run --comfy 0.3.10 --api 1.7.0
```