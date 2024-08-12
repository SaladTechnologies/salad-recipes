from fastapi import FastAPI
import random, string
from pydantic import BaseModel


app = FastAPI()

#Randomly generates a 16-character string
def randomCharacters(length):
   letters = string.ascii_lowercase
   return ''.join(random.choice(letters) for i in range(length))
Random = randomCharacters(16)

print("Your randomly generated string is:", Random, ". Does it match what you get over the API?")

#Classes
class Item(BaseModel):
    message: str

class Items(BaseModel):
    set: str

#Routes
@app.get("/")
async def root():
    print("Your current randomly generated string is:", Random)
    return {"Random String": Random}

@app.post("/hello")
async def hello(item: Item):
    message_dict = item.dict()
    if item.message == "Hello":
        return "Goodbye on IPv6"
    if item.message == "Goodbye":
        return "Hello on IPv6"
    
@app.post("/set")
async def set(item: Items):
    global Random
    message_dict = item.dict()
    Random = item.set or Random
    return {"New String": Random}