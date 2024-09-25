const assert = require('assert')
const fs = require('fs')

const { SALAD_API_KEY } = process.env
assert(SALAD_API_KEY, 'SALAD_API_KEY is required')

const headers = {
  'Salad-Api-Key': SALAD_API_KEY
};

async function main() {
  const cgAddress = process.argv[2];
  const output = process.argv[3];
  assert(cgAddress, 'Container Group address is required')
  const cgUrl=`https://api.salad.com/api/public/${cgAddress}`
  console.log(`Fetching container group from ${cgUrl}`)

  const res = await fetch(cgUrl, { headers })
  if (!res.ok) {
    console.log(await res.text())
    throw new Error(`Failed to fetch container group: ${res.status} ${res.statusText}`)
  }
  const containerGroup = await res.json()

  const {
    name,
    display_name,
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
    name,
    display_name,
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