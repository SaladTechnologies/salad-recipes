#!/usr/bin/env node

const assert = require('assert')
const fs = require('fs')
const path = require('path')

console.warn('This script is no longer maintained, in favor of the `recipe new --from-container-group` command. It will be removed in the future.')

const { SALAD_API_KEY } = process.env
assert(SALAD_API_KEY, 'SALAD_API_KEY is required')

const headers = {
  'Salad-Api-Key': SALAD_API_KEY
};

const usage = `
Usage: node scripts/get-container-group.js <container-group-address> <output-file>

Example:
node scripts/get-container-group.js \
organizations/salad-benchmarking/projects/recipe-staging/containers/dreamshaper8-comfyui \
recipes/comfyui/container-group.json
`

function normalizeRecipeName(name) {
  return name.replace(/[^a-z0-9]/ig, '-').toLowerCase()
}

function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

function convertAllKeysToCamelCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertAllKeysToCamelCase);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        snakeToCamel(key),
        convertAllKeysToCamelCase(value)
      ])
    );
  }
  return obj;
}

async function main() {
  const cgAddress = process.argv[2];
  const output = process.argv[3];
  assert(cgAddress, usage)
  assert(output, usage)
  const cgUrl=`https://api.salad.com/api/public/${cgAddress}`
  console.log(`Fetching container group from ${cgUrl}`)

  const res = await fetch(cgUrl, { headers })
  if (!res.ok) {
    console.log(await res.text())
    throw new Error(`Failed to fetch container group: ${res.status} ${res.statusText}`)
  }
  const containerGroup = await res.json()

  const recipeName = normalizeRecipeName(path.dirname(output).split('/').pop())

  const {
    container,
    restart_policy,
    networking,
    readiness_probe,
    startup_probe,
    liveness_probe,
  } = containerGroup;

  delete container.size;
  delete container.hash;
  container.priority = "high";

  
  let newDef = {
    name: recipeName,
    display_name: recipeName,
    readme: "$replace",
    container,
    autostart_policy: true,
    restart_policy,
    replicas: 3,
    readiness_probe,
    startup_probe,
    liveness_probe,
  }
  if (networking){
    delete networking.dns;
    newDef.networking = networking;
  }
  newDef = convertAllKeysToCamelCase(newDef);

  fs.writeFileSync(output, JSON.stringify(newDef, null, 2));
}

main()