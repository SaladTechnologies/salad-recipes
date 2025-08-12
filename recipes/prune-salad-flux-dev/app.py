import base64
import os
from io import BytesIO

import litserve as ls
import torch
from diffusers import FluxPipeline
from pruna import SmashConfig, smash
from starlette.middleware.cors import CORSMiddleware


class SimpleLitAPI(ls.LitAPI):
    def setup(self, device):
        # Load the model and tokenizer
        self.device = "cuda"

        # Get Hugging Face token from environment variable if available
        hf_token = os.environ["HF_TOKEN"]

        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True
        torch.backends.cudnn.benchmark = True
        torch.backends.cudnn.deterministic = False
        print("Loading model")
        pipe = FluxPipeline.from_pretrained(
            "black-forest-labs/FLUX.1-dev",
            torch_dtype=torch.bfloat16,
            token=hf_token,
        )
        print("model loaded")
        # Initialize the SmashConfig
        smash_config = SmashConfig()
        smash_config["factorizer"] = "qkv_diffusers"
        smash_config["cacher"] = "fora"
        # configure the torch_compile compiler
        smash_config["quantizer"] = "torchao"
        smash_config._prepare_saving = False
        smash_config.add_tokenizer(pipe.tokenizer)
        smash_config.device = "cpu"
        print("Smashing on CPU to fit the device")
        self.model = smash(
            model=pipe,
            smash_config=smash_config,
        )
        print("Model smashed. Going to cuda")
        self.model.to("cuda")
        print("Compiling model for speed optimization")
        for i, block in enumerate(self.model.cache_helper.double_stream_blocks_forward):
            self.model.cache_helper.double_stream_blocks_forward[i] = torch.compile(
                self.model.cache_helper.double_stream_blocks_forward[i],
                mode="max-autotune-no-cudagraphs",
            )
        for i, block in enumerate(self.model.cache_helper.single_stream_blocks_forward):
            self.model.cache_helper.single_stream_blocks_forward[i] = torch.compile(
                self.model.cache_helper.single_stream_blocks_forward[i],
                mode="max-autotune-no-cudagraphs",
            )
        print("model compiled")

        print("warming model up")
        self.predict(("A cat jumping in the sky", 28, 3.5))
        print("model Loaded and warm")

    def decode_request(self, request):
        # Extract prompt from request
        prompt = request["prompt"]
        num_inference_steps = request.get("num_inference_steps", 28)
        guidance_scale = request.get("guidance_scale", 3.5)
        return prompt, num_inference_steps, guidance_scale

    def predict(self, inputs):
        prompt, num_inference_steps, guidance_scale = inputs
        # Generate image from prompt
        with torch.no_grad():
            # Adjusted to directly access the generated image from the output without using the 'sample' key.
            # The output from the model is expected to be a list of PIL images.
            images = self.model(
                prompt,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
            )["images"]
            image = images[0]  # Assuming you want to retrieve the first image
        return image

    def health(self):
        return True

    def encode_response(self, image):
        # Convert the generated PIL Image to a Base64 string
        buffered = BytesIO()
        image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        return {"image": img_str}


if __name__ == "__main__":
    api = SimpleLitAPI(api_path="/invocations")
    cors_middleware = (
        CORSMiddleware,
        {
            "allow_origins": ["*"],  # Allows all origins
            "allow_methods": ["GET", "POST"],  # Allows GET and POST methods
            "allow_headers": ["*"],  # Allows all headers
        },
    )
    server = ls.LitServer(api,
                          healthcheck_path='/ping',
                          middlewares=[cors_middleware])
    server.run(port=8080, host="::")
