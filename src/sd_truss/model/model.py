from typing import Any
from dataclasses import asdict
from typing import Dict
import base64
from io import BytesIO

from PIL import Image


import torch
from diffusers import EulerDiscreteScheduler, StableDiffusionPipeline


def pil_to_b64(pil_img):
    buffered = BytesIO()
    pil_img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue())
    return "data:image/png;base64," + str(img_str)[2:-1]
    
    
class Model:
    def __init__(self, **kwargs) -> None:
        self._data_dir = kwargs["data_dir"]
        self._config = kwargs["config"]
        self._secrets = kwargs["secrets"]
        self._model = None

    def load(self):
        scheduler = EulerDiscreteScheduler.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            subfolder="scheduler",
        )
        self._model = StableDiffusionPipeline.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            scheduler=scheduler,
            torch_dtype=torch.float16,
        )
        self._model.unet.set_use_memory_efficient_attention_xformers(True)
        self._model = self._model.to("cuda")

    def preprocess(self, model_input: Any) -> Any:
        """
        Incorporate pre-processing required by the model if desired here.

        These might be feature transformations that are tightly coupled to the model.
        """
        return model_input

    def postprocess(self, model_output: Dict) -> Dict:
        # Convert to base64
        model_output["images"] = [pil_to_b64(img) for img in model_output["images"]]
        return asdict(model_output)

    def predict(self, model_input: Dict):
        response = self._model(**model_input)
        return response
