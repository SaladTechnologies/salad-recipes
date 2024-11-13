# Salad Recipes

- [Salad Recipes](#salad-recipes)
  - [Introduction](#introduction)
  - [Looking for Help with a Recipe?](#looking-for-help-with-a-recipe)
  - [Repository Structure](#repository-structure)
    - [Recipes](#recipes)
    - [Benchmark](#benchmark)
      - [`run`](#run)
      - [`process-results.js`](#process-resultsjs)
      - [`embed-result.js`](#embed-resultjs)
    - [Scripts](#scripts)


## Introduction

Recipes are the easiest way to start running an application on SaladCloud. By using recipes, you can run the most popular applications with pre-validated configurations. Simply head over to the [portal](https://portal.salad.com/) to create an account, which takes just a few minutes. Once the account is created, set up a payment method to pay for the resource usage. Once the payment method is set up, you can deploy recipes to any of the thousands of GPU powered nodes available on SaladCloud. With access to such a large number of nodes, you can be confident that there will always be the resources that you need to run your applications.

## Looking for Help with a Recipe?

Check [the docs](https://docs.salad.com/products/recipes/overview) and see if your question has already been answered.

If you don't find a solution, don't worry! Simply create a new issue and our team will be happy to help you out. We value your input and strive to provide the best possible support to all our users, so don't hesitate to reach out to us with any questions or concerns you may have.

## Repository Structure

### Recipes

This repository contains a collection of recipes for running popular applications on SaladCloud. Each recipe is stored in a separate directory within `src/`, with the name of the directory corresponding to the name of the application. In each recipe directory, you will see the following files:

- `readme.md`: A file containing information about the application and how to run it on SaladCloud. This may just link to a documentation page.
- `Dockerfile`: The Dockerfile used to build the image for the application.
- `build`: A script that builds the docker image for the application.
- `run`: A script that runs the application locally from the image you built in the previous step.
- `openapi.json` | `openapi.yaml`: An OpenAPI specification file for the application's API, if available.
- `container-group.json`: A file containing the configuration for the container group that will run the application on SaladCloud.
- `get-openapi-spec`: A script that fetches the OpenAPI specification for the application's API, if available.

Additionally, you may see a `benchmark` directory. This directory contains scripts for running benchmarks on the application to test its performance on SaladCloud, as well as the results of those benchmarks. Other contents may vary, but all `benchmark` directories will container at least one file:

- `benchmark.js`: A [K6](https://k6.io/) script that defines the benchmark to be run.

### Benchmark

The `benchmark` directory contains scripts for running and processing benchmarks on applications running on SaladCloud, as well as an embeddable [plotly graph](https://plotly.com/graphing-libraries/) that displays the results of the benchmarks. The `benchmark` directory contains multiple scripts.

#### `run`

```text
Usage: ./benchmark/run --org <org> --project <project> --container-group <container-group> --replicas <replicas> --recipe <recipe> [--output <output>]
```

This script does the following:

1. Starts the container group and waits for it to be ready.
2. Runs the benchmark script.
3. Stops the container group.
4. Processes the benchmark results.

#### `process-results.js`

```text
Usage: node benchmark/process-results.js <raw-results-file> [output-results-file]

  raw-results-file: The file containing the raw results from the k6 run, in JSON Lines format
  [output-results-file]: The file to write the processed results to. Defaults to results.json in the same directory as the raw-results-file
```

This script processes the raw results from a k6 run and outputs a JSON file containing the processed results ready to be rendered in the plotly graph.

#### `embed-result.js`

This is the script that can be embedded on an external website by linking to the raw content of the script. The script will fetch the configured results and render them in a plotly graph. You can see this demonstrated in `benchmark/result.html`.

### Scripts

The `scripts` directory contains scripts that are used to automate various tasks related to the recipes and benchmarks. The scripts are written in bash and node.js.