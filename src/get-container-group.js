const assert = require('assert')
const fs = require('fs')
const path = require('path')

const { SALAD_API_KEY } = process.env
assert(SALAD_API_KEY, 'SALAD_API_KEY is required')

const headers = {
  'Salad-Api-Key': SALAD_API_KEY
};

const usage = `
Usage: node get-container-group.js <container-group-address> <output-file>

Example:
node get-container-group.js \
organizations/salad-benchmarking/projects/recipe-staging/containers/comfyui-dreamshaper8 \
dreamshaper8-comfyui/container-group.json
`

function normalizeRecipeName(name) {
  return name.replace(/[^a-z0-9]/ig, '-').toLowerCase()
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

  delete networking.dns;
 
  const newDef = {
    name: recipeName,
    display_name: recipeName,
    container,
    autostart_policy: true,
    restart_policy,
    replicas: 3,
    networking,
    readiness_probe,
    startup_probe,
    liveness_probe,
  }

  fs.writeFileSync(output, JSON.stringify(newDef, null, 2));
}

main()