# Salad Recipes

## Introduction

Recipes are the easiest way to start running an application on Salad Cloud. By using recipes, you can run the most popular applications without having to worry about the underlying infrastructure. Simply head over to the [portal](https://portal.salad.com/) to create an account, which takes just a few minutes. Once the account is created, set up a payment method to pay for the resource usage. Once the payment method is set up, you can deploy recipes to any of the over 10,000 GPU powered nodes available on Salad. With access to such a large number of nodes, you can be confident that there will always be the resources that you need to run your applications. With Salad, you can focus on the applications and leave the infrastructure management to the experts.

## Looking for Help with a Recipe?

To ensure you get the best possible assistance, we encourage you to check the [issues](https://github.com/SaladTechnologies/salad-recipes/issues) first to see if your question has already been answered. If you don't find a solution, don't worry! Simply create a new issue and our team will be happy to help you out. We value your input and strive to provide the best possible support to all our users, so don't hesitate to reach out to us with any questions or concerns you may have.

## How to Create a New Recipe

1. Create a new directory for the recipe. This directory will also be the name of the new recipe.

2. Add the source code for the specific recipe. Each directory should produce a single docker.

   - We recommend using [Truss](https://truss.baseten.co/) if your model is hosted on Hugging Face to automatically create a container to run the model.

   - If you are creating a docker based recipe, a `Dockerfile` is required to be placed in the root of the recipe directory.

3. Update the Github action to automatically build the recipe.

   The build pipelines are setup to use the `matrix` feature, for each new recipe you simply need to add a line to the corresponding job (see details below) with the directory for the recipe and the desired version. Note: Only versions updated in the build pipeline will create a new build artifact

   ### Truss Recipes

   ```
    truss-recipe:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        include:
          - recipe-name: {NEW RECIPE DIRECTORY}
            version: "0.1"
          - recipe-name: bert-base-uncased
            version: "0.1"
        ...
   ```

   ### Docker Recipes

   ```
    docker-recipe:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        include:
          - recipe-name: {NEW RECIPE DIRECTORY}
            version: "0.1"
          - recipe-name: openjourney4
            version: "0.1"
            ...
   ```

4. Open a new Pull Request with the new recipe source code and the updated build configuration
