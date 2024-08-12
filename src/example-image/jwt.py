import requests

r = requests.get('http://169.254.169.254:80/v1/token')
token =r.json()['jwt']
print(token)
