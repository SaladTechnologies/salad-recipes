const fs = require("fs/promises");
const path = require("path");
const gpuPrices = require("./prices.json");
const exec = require("child_process").exec;

const usage = `Usage: benchmark/run-matrix.js [options]

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
`;

const { SALAD_API_KEY } = process.env;

function getOptions() {
  if (!SALAD_API_KEY) {
    console.error("Missing SALAD_API_KEY environment variable");
    process.exit(1);
  }
  const options = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "-h":
      case "--help":
        console.log(usage);
        process.exit(0);
      case "--recipe":
      case "--gpus":
      case "--cpus":
      case "--memory":
      case "--replicas":
      case "--benchmark":
      case "--org":
      case "--project":
        options[args[i].slice(2)] = args[++i];
        break;
      case "--show-options":
        options.showOptions = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        console.log(usage);
        process.exit(1);
    }
  }
  if (
    !options.recipe ||
    !options.gpus ||
    !options.cpus ||
    !options.memory ||
    !options.project
  ) {
    console.error("Missing required options");
    console.log(usage);
    process.exit(1);
  }
  options.replicas = parseInt(options.replicas) || 10;
  options.benchmark = options.benchmark || "benchmark.js";
  options.org = options.org || "salad-benchmarking";

  options.gpus = options.gpus.split(",").map(gpuId => gpuId.trim());
  options.cpus = options.cpus.split(",").map(i => parseInt(i));
  options.memory = options.memory.split(",").map(i => parseInt(i));

  return options;
}

function getNormalizedGpuName(gpuId) {
  const gpuName = gpuPrices.items.find((gpuDef) => gpuDef.id === gpuId).name;
  const normalizedGpuName = gpuName
    .toLowerCase()
    .replace(/\s/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return normalizedGpuName;
}

function getContainerGroupVariation(recipeConfig, gpu, cpus, memory, replicas) {
  const containerGroupVariation = JSON.parse(JSON.stringify(recipeConfig));
  const normalizedGpuName = getNormalizedGpuName(gpu);
  containerGroupVariation.name = `${recipeConfig.name}-${normalizedGpuName}-${cpus}cpu-${memory}memgb`.slice(0, 53);
  containerGroupVariation.display_name = containerGroupVariation.name;
  containerGroupVariation.container.resources.cpu = cpus;
  containerGroupVariation.container.resources.memory = memory * 1024;
  containerGroupVariation.container.resources.gpu_classes = [gpu];
  containerGroupVariation.replicas = replicas;
  containerGroupVariation.autostart_policy = false;
  return containerGroupVariation;
}

async function getContainerGroup(org, project, containerGroupName) {
  const url = `https://api.salad.com/api/public/organizations/${org}/projects/${project}/containers/${containerGroupName}`;
  const response = await fetch(url, {
    headers: {
      "Salad-Api-Key": SALAD_API_KEY,
    },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch container group:${response.status} - ${response.statusText}`
    );
  }
  return response.json();
}

async function createContainerGroup(org, project, containerGroupDefinition) {
  const url = `https://api.salad.com/api/public/organizations/${org}/projects/${project}/containers`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Salad-Api-Key": SALAD_API_KEY,
    },
    body: JSON.stringify(containerGroupDefinition),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to create container group:${response.status} - ${response.statusText}`
    );
  }
  return response.json();
}

async function main() {
  const options = getOptions();
  if (options.showOptions) {
    console.log(options);
  }
  const recipeContainerGroupConfigPath = path.join(
    "src",
    options.recipe,
    "container-group.json"
  );
  const recipeConfig = JSON.parse(
    await fs.readFile(recipeContainerGroupConfigPath, "utf-8")
  );

  console.log("Running benchmark matrix for recipe", recipeConfig.name);

  const containerGroups = [];
  for (const gpu of options.gpus) {
    for (const cpus of options.cpus) {
      for (const memory of options.memory) {
        containerGroups.push(
          getContainerGroupVariation(
            recipeConfig,
            gpu,
            cpus,
            memory,
            options.replicas
          )
        );
      }
    }
  }

  console.log(`Benchmark needs ${containerGroups.length} container groups`);

  for (const containerGroup of containerGroups) {
    try {
      await getContainerGroup(
        options.org,
        options.project,
        containerGroup.name
      );
      console.log(`  - Container group ${containerGroup.name} already exists`);
    } catch (error) {
      console.log(`  - Creating container group ${containerGroup.name}`);
      if (options.dryRun) {
        console.log("    - Dry run, skipping");
        continue;
      }
      await createContainerGroup(options.org, options.project, containerGroup);
      console.log("    - Done");
    }
  }

  console.log("Running benchmark matrix");
  const outcomes = await Promise.allSettled(
    containerGroups.map(async (containerGroup) => {
      const cmd = "benchmark/run";
      const benchmarkName = options.benchmark.split(".")[0];
      const args = [
        "--org",
        options.org,
        "--project",
        options.project,
        "--container-group",
        containerGroup.name,
        "--benchmark",
        options.benchmark,
        "--recipe",
        options.recipe,
        "--replicas",
        options.replicas,
        "--output",
        `${benchmarkName}-${getNormalizedGpuName(
          containerGroup.container.resources.gpu_classes[0]
        )}-${containerGroup.container.resources.cpu}cpu-${
          containerGroup.container.resources.memory / 1024
        }memgb.jsonl`,
      ];
      console.log(`  - Running benchmark for ${containerGroup.name}`);
      if (options.showOptions) {
        console.log(`    - ${cmd} ${args.join(" ")}`);
      }
      if (options.dryRun) {
        console.log("    - Dry run, skipping");
        return;
      }
      // Let stdout and stderr display normally
      return new Promise((resolve, reject) => {
        const child = exec(`${cmd} ${args.join(" ")}`, {
          env: { ...process.env },
        });
        child.setMaxListeners(Infinity);
        child.on("exit", (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Benchmark failed with code ${code}`));
          }
        });
        child.on("error", (error) => {
          reject(error);
        });
        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);
      });
    })
  );

  const failedOutcomes = outcomes.filter(
    (outcome) => outcome.status === "rejected"
  );
  if (failedOutcomes.length > 0) {
    console.error("Some benchmarks failed");
    failedOutcomes.forEach((outcome) => console.error(outcome.reason));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
