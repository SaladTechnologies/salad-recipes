# Do not edit if deploying to Banana Serverless
# This file is boilerplate for the http server, and follows a strict interface.

# Instead, edit the init() and inference() functions in app.py

from sanic import Sanic, response
import subprocess
import app as user_src
import traceback
import sys

# We do the model load-to-GPU step on server startup
# so the model object is available globally for reuse
user_src.init()

# Create the http server app
server = Sanic("my_app")

# Instructions for any GET request for usage
@server.route("/", methods=["GET"])
def instruction(request):
    text = "Follow the usage instructions available on the Recipe Card. https://portal.salad.com"
    return response.json(text)

# Healthchecks verify that the environment is correct on Banana Serverless
@server.route("/healthcheck", methods=["GET"])
def healthcheck(request):
    # dependency free way to check if GPU is visible
    gpu = False
    out = subprocess.run("nvidia-smi", shell=True)
    if out.returncode == 0:  # success state on shell command
        gpu = True

    return response.json({"state": "healthy", "gpu": gpu})


# Inference POST handler at '/' is called for every http call from Banana
@server.route("/", methods=["POST"])
def inference(request):
    try:
        model_inputs = response.json.loads(request.json)
    except:
        model_inputs = request.json

    try:
        output = user_src.inference(model_inputs)
    except Exception as err:

        errorStr = str(err)

        if 'CUDA error: unknown error' in errorStr:
             sys.exit()
        elif 'torch.cuda.is_available() should be True but is False' in errorStr:
             sys.exit()
        else:
            output = {
                "$error": {
                    "code": "APP_INFERENCE_ERROR",
                    "name": type(err).__name__,
                    "message": errorStr,
                    "stack": traceback.format_exc(),
                }
        }

    return response.json(output)


if __name__ == "__main__":
    server.run(host="0.0.0.0", port="50150", workers=1)
