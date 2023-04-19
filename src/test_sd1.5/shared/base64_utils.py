import base64
from io import BytesIO

from PIL import Image

def pil_to_b64(pil_img):
    buffered = BytesIO()
    pil_img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue())
    return "data:image/png;base64," + str(img_str)[2:-1]