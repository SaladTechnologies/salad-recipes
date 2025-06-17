#! /usr/bin/env node
const fs = require('fs/promises');
const { execSync } = require('child_process');


const usage = `usage: ${process.argv[1]} <command> [options]

Commands:
  import <recipe-json> <directory>  Import a recipe from a JSON file
  export <directory> <recipe-json>  Export a recipe to a JSON file
  new <directory>                   Create a new recipe directory with template files

`;

if (process.argv[2] === '--help' || process.argv[2] === '-h') {
  console.log(process.argv)
  console.error(usage);
  process.exit(1);
}

async function importRecipe(recipeJson, directory) {
  console.log(`Importing recipe from ${recipeJson} to ${directory}`);

  await fs.mkdir(directory, { recursive: true });

  try {
    const recipeData = await fs.readFile(recipeJson, 'utf8');
    const recipe = JSON.parse(recipeData);

    const containerGroup = recipe.container_template;
    const readme = containerGroup.readme;
    containerGroup.readme = "$replace"

    const form = recipe.form;
    const description = form.description;
    form.description = "$replace";

    const readmePath = `${directory}/container_template.readme.mdx`;
    const formPath = `${directory}/form.json`;
    const containerGroupPath = `${directory}/container-group.json`;
    const descriptionPath = `${directory}/form.description.mdx`;

    console.log(`Writing files to ${directory}`);
    await fs.writeFile(readmePath, readme);
    await fs.writeFile(formPath, JSON.stringify(form, null, 2));
    await fs.writeFile(containerGroupPath, JSON.stringify(containerGroup, null, 2));
    await fs.writeFile(descriptionPath, description);

    const miscPath = `${directory}/misc.json`;
    const { ui, documentation_url, short_description, workload_types} = recipe;
    const misc = {
      ui: ui || {},
      documentation_url: documentation_url || "",
      short_description: short_description || "",
      workload_types: workload_types || []
    };
    await fs.writeFile(miscPath, JSON.stringify(misc, null, 2));

    for (let i = 0; i < recipe.patches.length; i++) {
      const patches = recipe.patches[i];
      for (let j = 0; j < patches.length; j++) {
        const patch = patches[j];
        if (patch.op === "add" && patch.path === "/output/readme") {
          const outputReadmePath = `${directory}/patches.${i}.${j}.readme.mdx`;
          await fs.writeFile(outputReadmePath, patch.value);
          recipe.patches[i][j].value = "$replace";
        }
      }
    }
    const patchesPath = `${directory}/patches.json`;
    await fs.writeFile(patchesPath, JSON.stringify(recipe.patches, null, 2));

  } catch (err) {
    console.error(`Error reading or writing recipe:`, err);
    process.exit(1);
  }
}

async function exportRecipe(directory, recipeJson) {
  console.log(`Exporting recipe from ${directory} to ${recipeJson}`);

  try {
    const containerGroup = JSON.parse(await fs.readFile(`${directory}/container-group.json`, 'utf8'));
    containerGroup.readme = await fs.readFile(`${directory}/container_template.readme.mdx`, 'utf8')

    const form = JSON.parse(await fs.readFile(`${directory}/form.json`, 'utf8'));
    form.description = await fs.readFile(`${directory}/form.description.mdx`, 'utf8');

    const patches = JSON.parse(await fs.readFile(`${directory}/patches.json`, 'utf8'));

    const misc = JSON.parse(await fs.readFile(`${directory}/misc.json`, 'utf8'));

    for (let i = 0; i < patches.length; i++) {
      const patchArray = patches[i];
      for (let j = 0; j < patchArray.length; j++) {
        const patch = patchArray[j];
        if (patch.op === "add" && patch.path === "/output/readme" && patch.value === "$replace") {
          const readmePatch = `${directory}/patches.${i}.${j}.readme.mdx`;
          patches[i][j].value = await fs.readFile(readmePatch, 'utf8');
        }
      }
    }

    const recipe = {
      container_template: containerGroup,
      form: form,
      patches: patches,
      ...misc
    };
    await fs.writeFile(recipeJson, JSON.stringify(recipe, null, 2));
    execSync(`yarn prettier --write ${recipeJson}`, { stdio: 'inherit' });
  } catch (err) {
    console.error(`Error reading or writing recipe:`, err);
    process.exit(1);
  }
}

async function newRecipe(directory) {
  console.log(`Creating new recipe in ${directory}`);

  await fs.mkdir(directory, { recursive: true });

  const readmeContent = `# Recipe Readme
This is a placeholder for the recipe readme, visible from the deployed container group page. Replace this with your actual content.
  `;

  const descriptionContent = `# Recipe Description
This is a placeholder for the recipe description, visible from the recipe form. Replace this with your actual content.
  `;

  const formContent = {
    title: "My Recipe",
    description: "$replace",
    type: "object",
    required: [
      "container_group_name",
    ],
    properties: {
      container_group_name: {
        title: "Container Group Name",
        description: "Must be 2-63 lowercase letters, numbers, or hyphens. Cannot start with a number or start or end with a hyphen.",
        type: "string",
        maxLength: 63,
        minLength: 2,
        pattern: "^[a-z][a-z0-9-]{0,61}[a-z0-9]$",
        default: ""
      },
      networking_auth: {
        title: "Require Container Gateway Authentication",
        description: "When enabled, requests must include a SaladCloud API Key. When disabled, any anonymous request will be allowed.",
        type: "boolean",
        default: true
      }
    },
  }

  const containerGroupContent = {
    autostartPolicy: true,
    container: {
      environmentVariables: {},
      image: "",
      imageCaching: true,
      priority: "high",
      resources: {
        cpu: 1,
        memory: 1024, // 1 GB
        gpuClasses: [
          "a5db5c50-cbcb-4596-ae80-6a0c8090d80f" // RTX 3090
        ],
        storageAmount: 1073741824 // 1 GB
      },
    },
    name: "",
    networking: {
      auth: true,
      clientRequestTimeout: 100000,
      loadBalancer: "least_number_of_connections",
      port: 3000,
      protocol: "http",
      serverResponseTimeout: 100000,
      singleConnectionLimit: false
    },
    replicas: 3,
    restartPolicy: "always",
    readme: "$replace",
    readinessProbe: {
      failureThreshold: 1,
      http: {
        headers: [],
        path: "/ready",
        port: 3000,
        scheme: "http"
      },
      initialDelaySeconds: 0,
      periodSeconds: 3,
      successThreshold: 1,
      timeoutSeconds: 10
    }
  };

  const patches = [
    [
      {
        "op": "copy",
        "from": "/input/autostart_policy",
        "path": "/output/autostartPolicy"
      },
      {
        "op": "copy",
        "from": "/input/replicas",
        "path": "/output/replicas"
      },
      {
        "op": "copy",
        "from": "/input/container_group_name",
        "path": "/output/name"
      },
      {
        "op": "copy",
        "from": "/input/networking_auth",
        "path": "/output/networking/auth"
      }
    ],
  ];

  const miscContent = {
    ui: {},
    documentation_url: "",
    short_description: "",
    workload_types: []
  };

  await fs.writeFile(`${directory}/container_template.readme.mdx`, readmeContent);
  await fs.writeFile(`${directory}/form.json`, JSON.stringify(formContent, null, 2));
  await fs.writeFile(`${directory}/container-group.json`, JSON.stringify(containerGroupContent, null, 2));
  await fs.writeFile(`${directory}/form.description.mdx`, "This is a placeholder for the form description. Replace this with your actual content.");
  await fs.writeFile(`${directory}/misc.json`, JSON.stringify(miscContent, null, 2));
  await fs.writeFile(`${directory}/patches.json`, JSON.stringify(patches, null, 2));

  console.log(`New recipe created in ${directory}`);

}

async function main() {
  const command = process.argv[2];

  if (command === 'import') {
    if (process.argv.length !== 5) {
      console.error(`Usage: ${process.argv[1]} import <recipe-json> <directory>`);
      process.exit(1);
    }
    const recipeJson = process.argv[3];
    const directory = process.argv[4];
    await importRecipe(recipeJson, directory);

  } else if (command === 'export') {
    if (process.argv.length !== 5) {
      console.error(`Usage: ${process.argv[1]} export <directory> <recipe-json>`);
      process.exit(1);
    }
    const directory = process.argv[3];
    const recipeJson = process.argv[4];
    await exportRecipe(directory, recipeJson);
  } else if ( command === 'new') {
    if (process.argv.length !== 4) {
      console.error(`Usage: ${process.argv[1]} new <directory>`);
      process.exit(1);
    }
    const directory = process.argv[3];
    await newRecipe(directory);

  } else {
    console.error(`Unknown command: ${command}`);
    console.error(usage);
    process.exit(1);
  }
}

main()
