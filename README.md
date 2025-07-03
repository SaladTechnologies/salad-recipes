# Salad Recipes

- [Salad Recipes](#salad-recipes)
  - [Submitting Recipes](#submitting-recipes)
    - [Developing Recipes](#developing-recipes)
      - [Troubleshooting Common Issues](#troubleshooting-common-issues)
    - [Using Variables in Recipe Readmes](#using-variables-in-recipe-readmes)
    - [Form Limitations](#form-limitations)
    - [Recipe CLI Tool](#recipe-cli-tool)
  - [Repository Structure](#repository-structure)
    - [Recipes](#recipes)
    - [Scripts](#scripts)
      - [`scripts/salad-api.sh`](#scriptssalad-apish)
      - [`scripts/update-benchmark-pricing.sh`](#scriptsupdate-benchmark-pricingsh)
      - [`scripts/start-container-group-and-wait-for-replicas.sh`](#scriptsstart-container-group-and-wait-for-replicassh)
      - [`scripts/monitor-node-count.sh`](#scriptsmonitor-node-countsh)
      - [`scripts/run-container-gateway-benchmark.sh`](#scriptsrun-container-gateway-benchmarksh)
      - [`scripts/run-benchmark-matrix.js`](#scriptsrun-benchmark-matrixjs)

Recipes are pre-configured container group templates that can be used to quickly deploy popular AI models and applications. Those in the `recipes/` directory can be deployed directly from the [SaladCloud Portal](https://portal.salad.com/) or with the [Recipe CLI](#recipe-cli-tool) included in this repo, and any others can be deployed using the [SaladCloud API.](https://docs.salad.com/reference/api-usage)

## Submitting Recipes

If you want to make your application available to Salad users as a recipe, please first reach out to [support](mailto:support@salad.com). Partner and community recipes are a new addition to the Salad platform, and we want to ensure that your recipe is a good fit for our users.

Once approved by the Salad team, submit a pull request with your recipe files in the `recipes/` directory. Before submitting, please ensure that your recipe meets the following criteria:

- The recipe should be well-documented, with a clear description of what it does and how to use it.
- The recipe should be tested and working correctly on the Salad platform.
- The recipe should not include any proprietary or sensitive information. (this is a public repository)
- The recipe should not include any illegal or harmful content.
- The recipe should use a public docker image.

### Developing Recipes

This repo includes a CLI tool to help you develop recipes. It can be used to create new recipes, move recipes in an out of their single-file format, and deploy recipes to Salad. The tool can be run using [`npx recipe`](#recipe-cli-tool).

The recommended flow for developing recipes is:

1. Get your application running reliably and as intended in a Salad Container Group.
2. Create a fork or branch of this repository.
3. Create a new directory in the `recipes/` directory for your recipe.
4. Populate the directory with boilerplate files using the [`npx recipe`](#recipe-cli-tool) `new recipes/<recipe-name>` command. You can use the `--from-container-group <container-group-name>` option to create the recipe from an existing container group. Ensure that your Salad API key is set in the `SALAD_API_KEY` environment variable. This tool will set the replica count to 3, so override this if your recipe has a better default value.
5. If there are environment variables that need to be set by the user, make sure to remove them from `container-group.json` and add them to `form.json` instead, to include them in the recipe form.
6. Fill out the readme files in the recipe directory, including `container_template.readme.mdx` and `form.description.mdx`. Most GitHub-flavored markdown is supported, but you can also use JSX syntax in the `.mdx` files to dynamically render content based on the properties of the container group. This allows you to include links, code blocks, and other dynamic content in your readme files.
   - The `container_template.readme.mdx` file is displayed in the SaladCloud Portal after deployment.
   - The `form.description.mdx` file is displayed in the SaladCloud Portal before deployment, and should include instructions for deploying the recipe.
   - If your recipe has multiple variants or configuration options, you can create additional readme files named `patches.*.*.readme.mdx`, where `*.*` corresponds to the index in `patches.json`.
7. If your recipe has multiple variants, or configuration options, extend `patches.json` to include the necessary patches, and create additional readme files as needed.
8. Use the [`npx recipe`](#recipe-cli-tool) `export recipes/<your-recipe> recipes/<your-recipe>/recipe.json` command to export your recipe to a single file format, which is what we ultimately publish to the SaladCloud Portal.
9. Use the [`npx recipe`](#recipe-cli-tool) `deploy recipes/<your-recipe>/recipe.json` command to test deploying your recipe to Salad. This will prompt you for any required configuration values and deploy the recipe to Salad. After deployment, it will output the readme for the recipe, which you can use to verify that everything is working as expected.
10. Finally, create a pull request with your changes, and ensure that the Salad team reviews and approves your recipe.

Explore the other recipes in the `recipes/` directory to see how they are structured and [what files they include](#recipes).

#### Troubleshooting Common Issues

- If you encounter issues with the recipe CLI tool, ensure that you have Node.js 20+ installed and that you have run `npm install` to install the necessary dependencies.
- If your recipe uses the container gateway, ensure that your application is configured to listen on ipv6, which typically means the hostname should be set to `::` or `*` depending on your server.
- If your recipe uses the container gateway, make sure to use a readiness probe to ensure that traffic is not sent to the container until it is ready to handle requests. This can be done by adding a `readinessProbe` to your `container-group.json` file.

### Using Variables in Recipe Readmes

You can access a variety of information about the deployed container group to dynamically populate your readme files. This is accomplished using JSX syntax in the `.mdx` files. This only works in the post-deployment readme, not in the pre-deployment form description. Here are some examples of what you can access:

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

Within the JSX syntax, you can also use ternary expressions and optional chaining to conditionally render content based on the properties of the container group. For example:

```jsx
{props?.networking?.dns ? <Link url={`https://${props.networking.dns}/lab`}>JupyterLab</Link> : <div> hello </div>} 
```

### Form Limitations

You can use the `form.json` file to define the form fields that will be displayed in the SaladCloud Portal when deploying your recipe. However, there are a few things to keep in mind:

- The portal will always prompt for replica count and autostart policy, so you do not need to include these in your `form.json` file. They do need to go in `patches.json`, though.
- Any fields that would change the per-replica cost of the deployment cannot be modified using the form. This means you cannot change GPU class, CPU count, or memory size in the form. These should be defined in the `container-group.json` file.
- Required fields should omit a default value, and set a `minLength` of at least 1. This will ensure that the portal forces the user to fill in the field before deploying the recipe.

### Recipe CLI Tool

This repo includes a CLI tool to help you develop recipes. It can be used to create new recipes, move recipes in an out of their single-file format, and deploy recipes to Salad. The tool can be run using `npx recipe`.

Notes:

- You must have Node.js 20+ installed to use the CLI tool. You can use `nvm use` to switch to the correct version.
- Run `npm install` to install the necessary dependencies before using the CLI tool.
- Functions that interact with the Salad API require your Salad API key to be set in the `SALAD_API_KEY` environment variable.

```text
Explore and Manage Recipes for SaladCloud

VERSION
  salad-recipes/1.0.0 wsl-x64 node-v24.2.0

USAGE
  $ recipe [COMMAND]

COMMANDS
  deploy  Deploy a recipe to Salad Cloud
  export  Export a recipe to a JSON file
  import  Import a recipe from a JSON file
  new     create a new boilerplate recipe
```

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
