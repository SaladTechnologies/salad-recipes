# Salad Recipes

- [Salad Recipes](#salad-recipes)
  - [Repository Structure](#repository-structure)
    - [Recipes](#recipes)
    - [Scripts](#scripts)
      - [`scripts/salad-api.sh`](#scriptssalad-apish)
      - [`scripts/get-container-group.js`](#scriptsget-container-groupjs)
      - [`scripts/recipe-tool.js`](#scriptsrecipe-tooljs)
      - [`scripts/update-benchmark-pricing.sh`](#scriptsupdate-benchmark-pricingsh)
      - [`scripts/start-container-group-and-wait-for-replicas.sh`](#scriptsstart-container-group-and-wait-for-replicassh)
      - [`scripts/monitor-node-count.sh`](#scriptsmonitor-node-countsh)
      - [`scripts/run-container-gateway-benchmark.sh`](#scriptsrun-container-gateway-benchmarksh)
      - [`scripts/run-benchmark-matrix.js`](#scriptsrun-benchmark-matrixjs)
  - [Submitting Recipes](#submitting-recipes)
    - [Developing Recipes](#developing-recipes)
    - [Using Variables in Recipe Readmes](#using-variables-in-recipe-readmes)


Recipes are pre-configured container group templates that can be used to quickly deploy popular AI models and applications. Those in the `recipes/` directory can be deployed directly from the [SaladCloud Portal](https://portal.salad.com/), and any others can be deployed using the [SaladCloud API.](https://docs.salad.com/reference/api-usage)

## Repository Structure

> The `src/` directory should be considered deprecated. The contents of `recipes/` are now the primary source of truth for recipes, but the `src/` directory remains for backwards compatibility with existing scripts and workflows.
> The `benchmark/` directory should be considered deprecated. The important bits of it have been moved to `scripts/`, but the directory remains for backwards compatibility with existing scripts and workflows.

### Recipes

The `recipes/` directory contains a directory for each recipe. Within each recipe directory, there are several files:

- Often 1 or more `Dockerfile` files, but partner and community recipes may not include a Dockerfile.
- `container-group.json` - The container group definition file.
- `container_template.readme.mdx` - The readme file for the container group, which is displayed in the SaladCloud Portal, post-deployment.
- `form.description.mdx` - The description file for the container group, which is displayed in the SaladCloud Portal, pre-deployment.
- `form.json` - A JSON schema file that defines form fields for the recipe deployment page.
- `patches.json` - A JSON file that contains patches to apply to the container group definition. This can include conditional patches based on form values.
- `misc.json` - A JSON file that contains miscellaneous information about the recipe, such as miscellaneous UI info, docs links, and categories.
- `patches.*.*.readme.mdx` - Sometimes you want a different readme depending on the recipes variant or configuration. These files allow you to provide a different readme for each variant or configuration of the recipe. The `*.*` value is the index in `patches.json`
- `recipe.json` - The above `.mdx` and `.json` files are combined into a single `recipe.json` file, which is used by the SaladCloud Portal to display the recipe and its details.
- Sometimes there are additional scripts and files that are used with the recipe.

### Scripts

The `scripts/` directory contains a variety of utility scripts that can be used when developing or testing recipes. Most scripts require your Salad API key to be set in the `SALAD_API_KEY` environment variable.

#### `scripts/salad-api.sh`

This script provides functions for interacting with the Salad API. It relies on `curl` and `jq` to make API requests and parse the responses.

Use: `source scripts/salad-api.sh` to load the Salad API functions into your shell.

Functions include:

- `getCurrentStatus <org> <project> <container_group>`: Get the current status of a container group.
- `startContainerGroup <org> <project> <container_group>`: Start a container group.
- `stopContainerGroup <org> <project> <container_group>`: Stop a container group.
- `getConfiguredReplicas <org> <project> <container_group>`: Get the number of replicas configured for a container group.
- `setReplicas <org> <project> <container_group> <replicas>`: Set the number of replicas for a container group.
- `getRunningReplicas <org> <project> <container_group>`: Get the number of running replicas for a container group.
- `getAccessDomainName <org> <project> <container_group>`: Get the access domain name for a container group.
- `getAllPrices <org>`: Get all gpu classes and their prices.
- `getContainerGroup <org> <project> <container_group>`: Get the container group definition.
- `createContainerGroup <org> <project> <request-body>`: Create a new container group.
- `createQueue <org> <project> <request-body>`: Create a new queue for a project.
- `getQueue <org> <project> <queue_name>`: Get the details of a queue.
- `getJob <org> <project> <queue_name> <job_id>`: Get the details of a job in a queue.
- `createJob <org> <project> <queue_name> <request-body>`: Create a new job in a queue.
- `watchJob <org> <project> <queue_name> <job_id> [<interval>]`: Watch a job in a queue and print its status.

#### `scripts/get-container-group.js`

The script retrieves the container group definition, strips it down to what is needed to create a new container group, and camelCases all keys.

Use:

```text
Usage: node scripts/get-container-group.js <container-group-address> <output-file>

Example:
./scripts/get-container-group.js \
organizations/salad-benchmarking/projects/recipe-staging/containers/dreamshaper8-comfyui \
recipes/comfyui/container-group.json
```

#### `scripts/recipe-tool.js`

A command line utility for exporting and importing recipes from their final single-file format to the multiple-file format used in the repository.

Use:

```text
Usage ./scripts/recipe-tool.js <command> [options]

Commands:
  export <recipe-dir> <recipe-file>  Export a recipe from its multiple-file format to the final single-file format.
  import <recipe-file> <recipe-dir>   Import a recipe from the final single-file format to its multiple-file format.
  new <recipe-dir> Populate a directory with a new recipe template.
```

#### `scripts/update-benchmark-pricing.sh`

This script updates `benchmark/prices.json` with the latest prices from the Salad API. It uses the `getAllPrices` function from `scripts/salad-api.sh`.

Use:

```text
Usage: ./scripts/update-benchmark-pricing.sh [<org>]
```

#### `scripts/start-container-group-and-wait-for-replicas.sh`

This script starts a container group and waits for the specified number of replicas to be running. It will set the replica count to the specified value if the existing configured value is less than the desired value.

Use:

```text
Usage: ./scripts/start-container-group-and-wait-for-replicas.sh \
--org <org> \
--project <project> \
--container-group <container_group> \
--replicas <replicas>
```

#### `scripts/monitor-node-count.sh`

This script monitors the number of running replicas for a container group and writes the current time and running replicas to a CSV file. It can be used to track the fill ratio of a container group over time.

Use:

```text
Usage: ./scripts/monitor-node-count.sh \
--org <org> \
--project <project> \
--container-group <container_group> \
--output <output-file.csv>
```

#### `scripts/run-container-gateway-benchmark.sh`

This script runs a Graphana K6 benchmark against a container group that is set up with access via the container gateway. It requires the `SALAD_API_KEY` environment variable to be set, and a valid benchmark javascript file for K6 to run.

```text
Usage: ./scripts/run-container-gateway-benchmark.sh --org <org> --project <project> --replicas <replicas> --recipe <recipe> [--container-group <container-group>] [--output <output>]

Options:
  --org <org>               The organization name
  --project <project>       The project name
  [--container-group <container-group>] The container group name. If not specified, it is assumed to be the same as the recipe name
  --replicas <replicas>     The number of replicas to start
  --recipe <recipe>         The recipe name
  [--output <output>]         The output file name (default: <benchmark-name>-results.jsonl)
  [--benchmark <benchmark>] The benchmark file (default: benchmark.js, means benchmark name of "benchmark")
```

Running the script will start the container group, wait for the specified number of replicas to be running, and then run the benchmark against the container group. When completed, it will stop the container group.

Several output files will be generated, all named based on the `<benchmark-name>`.

- `-node-count.csv`: Contains the number of running replicas over time.
- `-test-config.json`: Contains the container group configuration at the time of the benchmark.
- `-console.txt`: Contains the console output from the benchmark run.
- `-results.jsonl`: contains the K6 output in JSON lines format.

#### `scripts/run-benchmark-matrix.js`

This script runs a benchmark for each combination of settings provided.

```text
Usage: ./benchmark/run-matrix.js [options]

Options:
  -h, --help                 Show this help message and exit.
  --recipe <recipe>          Recipe to run. Required.
  --project <project>        Project that will contain all container groups. Required.
  --gpus <gpus>              Comma-separated list of GPU ids to use. Required.
  --cpus <cpus>              Comma-separated list of CPU numbers to use. Required.
  --memory <memory>          Comma-separated list of memory sizes to use in GB. Required.
  [--replicas <replicas>]    Number of replicas to run. Default 10
  [--benchmark <benchmark>]  Benchmark to run. Default benchmark.js
  [--org <org>]              Organization to use. Default salad-benchmarking
  [--show-options]           Show options.
  [--dry-run]                Do not create container groups or run benchmarks.
```

## Submitting Recipes

If you want to make your application available to Salad users as a recipe, please first reach out to [support](mailto:support@salad.com). Partner and community recipes are a new addition to the Salad platform, and we want to ensure that your recipe is a good fit for our users.

Once approved by the salad team, submit a pull request with your recipe files in the `recipes/` directory. Before submitting, please ensure that your recipe meets the following criteria:

- The recipe should be well-documented, with a clear description of what it does and how to use it.
- The recipe should be tested and working correctly on the Salad platform.
- The recipe should not include any proprietary or sensitive information. (this is a public repository)
- The recipe should not include any illegal or harmful content.
- The recipe should use a public docker image.

### Developing Recipes

The recommended flow for developing recipes is:

1. Get your application running reliably and as intended in a Salad Container Group.
2. Create a fork or branch of this repository.
3. Create a new directory in the `recipes/` directory for your recipe.
4. Populate the directory with boilerplate files using the `./scripts/recipe-tool.js new recipes/<your-recipe>` command.
5. Use your working container group to get the container group definition using the `./scripts/get-container-group.js <container-group-address> recipes/<your-recipe>/container-group.json` command. Ensure that your Salad API key is set in the `SALAD_API_KEY` environment variable. This tool will set the replica count to 3, so override this if your recipe has a better default value.
6. If there are environment variables that need to be set by the user, make sure to remove them from `container-group.json` and add them to `form.json` instead, to include them in the recipe form.
7. Fill out the readme files in the recipe directory, including `container_template.readme.mdx` and `form.description.mdx`.
8. If your recipe has multiple variants, or configuration options, extend `patches.json` to include the necessary patches, and create additional readme files as needed.
9. Use the `./scripts/recipe-tool.js export recipes/<your-recipe> recipes/<your-recipe>/recipe.json` command to export your recipe to a single file format, which is what we ultimately publish to the SaladCloud Portal.

Explore the other recipes in the `recipes/` directory to see how they are structured and what files they include.

### Using Variables in Recipe Readmes

You can access a variety of information about the deployed container group to dynamically populate your readme files. This is accomplished using JSX syntax in the `.mdx` files. Here are some examples of what you can access:

```jsx
<Link url={`https://${props.networking.dns}/docs`}>Swagger Docs</Link>
```

```jsx
<CodeBlock language="bash">{`curl https://${props.networking.dns}/api/chat \\
    -X POST \\
    -H 'Content-Type: application/json' \\
    -H 'Salad-Api-Key: ${props.apiKey}' \\
    -d '{"model": "${props.container.environmentVariables.OLLAMA_MODEL_NAME}","messages": [{"role": "system","content": "You are a helpful assistant."},{"role": "user","content": "What is deep learning?"}],"stream": true,"max_tokens": 128}'
`}</CodeBlock>
```

The `props` object has the camelCase schema of the container group, and a special value `props.apiKey` that contains the logged-in users Salad API key, which is used to authenticate API requests.
