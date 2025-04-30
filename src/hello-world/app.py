from fastapi import FastAPI
import os

salad_machine_id = os.getenv("SALAD_MACHINE_ID", "localhost")

app = FastAPI()


@app.get("/hello")
async def hello_world():
    return {"message": "Hello, World!", "salad_machine_id": salad_machine_id}


@app.get("/started")
async def startup_probe():
    return {"message": "Started!"}


@app.get("/ready")
async def readiness_probe():
    return {"message": "Ready!"}


@app.get("/live")
async def liveness_probe():
    return {"message": "Live!"}
