#!/bin/bash

# Set the name of the Docker image
IMAGE_NAME=${1:-"ollama-llama3.1-recipe"}

# Set the version of the Docker image
VERSION=${2:-"1.0.0"}

# Set the Docker Hub username and organization
DOCKER_HUB_USERNAME="maksimgorkii"
DOCKER_HUB_ORG="saladtechnologies"

# Build the Docker image
docker build -t $DOCKER_HUB_ORG/$IMAGE_NAME:$VERSION .
# docker build -t $DOCKER_HUB_ORG/$IMAGE_NAME:$VERSION .
# Log in to Docker Hub
echo "Please enter your Docker Hub password:"
echo "Pass190789!" | docker login -u $DOCKER_HUB_USERNAME --password-stdin

# Push the Docker image to Docker Hub
docker push $DOCKER_HUB_ORG/$IMAGE_NAME:$VERSION