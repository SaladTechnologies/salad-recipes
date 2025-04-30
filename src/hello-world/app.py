from fastapi import FastAPI


app = FastAPI()


@app.get("/hello")
async def hello_world():
    return {"message": "Hello, World!"}


@app.get("/started")
async def start_probe():
    return {"message": "Started!"}


@app.get("/ready")
async def ready_probe():
    return {"message": "Ready!"}


@app.get("/live")
async def live_probe():
    return {"message": "Live!"}
