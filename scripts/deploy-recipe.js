#! /usr/bin/env node

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.warn(`This tool is deprecated and will be removed in the future. Please use npx recipe instead.`);

const { SALAD_API_KEY } = process.env
assert(SALAD_API_KEY, 'SALAD_API_KEY is required')

const usage = `
Usage: ./${process.argv[1]} <path-to-recipe-json>
`

async function promptBoolean(defaultValue) {
  const prompt = `Enter "t" for true, "f" for false`
  if (defaultValue !== undefined) {
    console.log(`${prompt} (default: ${defaultValue ? 'true' : 'false'}): `)
  }
  const value = await new Promise((resolve) => {
    process.stdin.once('data', (data) => {
      const input = data.toString().trim().toLowerCase()
      resolve(input ? input === 't' : defaultValue)
    })
  })
  return value
}

async function promptNumber(defaultValue) {
  const prompt = 'Please enter a number'
  if (defaultValue !== undefined) {
    console.log(`${prompt} (default: ${defaultValue}): `)
  }
  const value = await new Promise((resolve) => {
    process.stdin.once('data', (data) => {
      const input = data.toString().trim()
      resolve(input ? parseInt(input) : defaultValue)
    })
  })
  if (isNaN(value)) {
    console.error(`Error: Value must be a valid number.`)
    return null
  }
  return value
}

async function promptEnum(options, defaultValue) {
  const prompt = 'Please enter one of the following options:\n'
  options.forEach((option, i) => {
    console.log(`${i + 1}. ${option}`)
  })
  if (defaultValue !== undefined) {
    console.log(`(default: ${defaultValue})`)
  }
  const value = await new Promise((resolve) => {
    process.stdin.once('data', (data) => {
      const input = data.toString().trim()
      if (input) {
        const index = parseInt(input) - 1
        if (index >= 0 && index < options.length) {
          resolve(options[index])
        } else {
          console.error(`Error: Invalid option selected.`)
          resolve(null)
        }
      } else {
        resolve(defaultValue)
      }
    })
  })
  return value
}

async function promptString(defaultValue) {
  const prompt = 'Please enter a value'
  if (defaultValue !== undefined) {
    console.log(`${prompt} (default: ${defaultValue}): `)
  } else {
    console.log(`${prompt}: `)
  }
  const value = await new Promise((resolve) => {
    process.stdin.once('data', (data) => {
      const input = data.toString().trim()
      resolve(input || defaultValue)
    })
  })
  return value
}

function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase())
}

function camelAllKeys(obj) {
  if (Array.isArray(obj)) {
    return obj.map(camelAllKeys)
  } else if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(Object.entries(obj).map(([key, value]) => [snakeToCamel(key), camelAllKeys(value)]))
  }
  return obj
}

async function getInputs(form, ui) {
  const input = {}
  for (const field in form.properties) {
    const required = form?.required.includes(field) ? '(required) ' : ''
    console.log(`${required}${form.properties[field].title}:\n${form.properties[field].description || ''}`)
    let value
    if (form.properties[field].type === 'boolean') {
      value = await promptBoolean(form.properties[field].default)
    } else if (form.properties[field].type === 'number') {
      value = await promptNumber(form.properties[field].default)
    } else if (form.properties[field].type === 'string' && form.properties[field].enum) {
      let enumOptions = form.properties[field].enum
      let usedLabels = false
      let defaultValue = form.properties[field].default
      if (ui && ui[field] && ui[field]['ui:enumNames']) {
        assert(Array.isArray(ui[field]['ui:enumNames']), `ui:enumNames for field "${field}" must be an array`)
        assert(
          ui[field]['ui:enumNames'].length === enumOptions.length,
          `ui:enumNames for field "${field}" must have the same length as enum options`,
        )
        enumOptions = ui[field]['ui:enumNames']
        defaultValue = ui[field]['ui:enumNames'][form.properties[field].enum.indexOf(defaultValue)]
        usedLabels = true
      }
      value = await promptEnum(enumOptions, defaultValue)
      if (usedLabels) {
        // If using labels, map back to original enum values
        const index = enumOptions.indexOf(value)
        if (index !== -1) {
          value = form.properties[field].enum[index]
        } else {
          throw new Error(`Selected option "${value}" is not valid.`)
        }
      }
    } else if (form.properties[field].type === 'string') {
      value = await promptString(form.properties[field].default)
    } else {
      throw new Error(`Unsupported field type "${form.properties[field].type}" for field "${field}".`)
    }

    if (form.required.includes(field) && (value === undefined || value === null || value === '')) {
      throw new Error(`Field "${field}" is required but no value was provided.`)
    }
    input[field] = value
  }

  if (form.dependencies) {
    for (const depField in form.dependencies) {
      if (!form.dependencies[depField].oneOf) {
        console.error(`Invalid dependency format for field "${depField}". Expected "oneOf" property.`)
        continue
      }
      for (const dep of form.dependencies[depField].oneOf) {
        const matches = dep.properties[depField].enum.includes(input[depField])
        if (matches) {
          const subForm = JSON.parse(JSON.stringify(dep))
          delete subForm.properties[depField] // Remove the dependency field from the sub-input
          const subInputs = await getInputs(subForm)
          Object.assign(input, subInputs)
          break // Only apply the first matching dependency
        }
      }
    }
  }
  return input
}

function setNestedValue(obj, path, value) {
  const lastKey = path[path.length - 1]
  const parentPath = path.slice(0, -1)

  // Navigate to the parent object
  let current = obj
  for (const key of parentPath) {
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {}
    }
    current = current[key]
  }

  // Set the value
  current[lastKey] = value
  return obj
}

function applyPatches(containerTemplate, inputs, patches) {
  const output = JSON.parse(JSON.stringify(containerTemplate)) // Deep copy to avoid mutating the original
  for (const patchBlock of patches) {
    for (const patch of patchBlock) {
      if (patch.op === 'test') {
        const fieldToTest = patch.path.split('/').pop()
        if (inputs[fieldToTest] !== patch.value) {
          break // Skip this block if the test fails
        }
      } else if (patch.op === 'copy') {
        const sourceField = patch.from.split('/').pop()
        const sourceValue = inputs[sourceField]
        if (sourceValue === undefined) {
          continue
        }
        const targetField = patch.path.split('/').slice(2)
        setNestedValue(output, targetField, sourceValue)
      } else if (patch.op === 'add') {
        const targetField = patch.path.split('/').slice(2)
        // Traverse output to find the target field, and add the value
        setNestedValue(output, targetField, patch.value)
      }
    }
  }
  return output
}

async function createContainerGroup(org, project, containerGroupDefinition) {
  const url = `https://api.salad.com/api/public/organizations/${org}/projects/${project}/containers`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Salad-Api-Key': SALAD_API_KEY,
    },
    body: JSON.stringify(containerGroupDefinition),
  })
  if (!response.ok) {
    let body = await response.text()
    try {
      body = JSON.parse(body)
      body = JSON.stringify(body, null, 2)
    } catch (e) {}
    console.error(body)
    throw new Error(`Failed to create container group:${response.status} - ${response.statusText}`)
  }
  return response.json()
}

function camelToSnakeCase(str) {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

function snakeAllKeys(obj) {
  if (Array.isArray(obj)) {
    return obj.map(snakeAllKeys)
  } else if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(Object.entries(obj).map(([key, value]) => {
      if (key === 'environmentVariables') {
        return [camelToSnakeCase(key), value] // Keep environmentVariables as is
      }
      return [camelToSnakeCase(key), snakeAllKeys(value)]
    }))
  }
  return obj
}

function renderReadme(readme, props) {
  if (!readme) return ''
  // Readme has js template literals that need to be evaluated
  const literalRegex = /=?{(`[^`]+`)}/g
  const allMatches = readme.matchAll(literalRegex)
  if (!allMatches) {
    console.warn('No template literals found in readme. Returning original readme.')
    return readme
  }
  let renderedReadme = readme
  for (const match of allMatches) {
    const fullMatch = match[0]
    const literal = match[1]
    const renderedLiteral = eval(literal)
    // if the literal is preceded by a =, wrap it in quotes
    if (fullMatch.startsWith('=')) {
      renderedReadme = renderedReadme.replace(fullMatch, `="${renderedLiteral}"`)
    } else {
      renderedReadme = renderedReadme.replace(fullMatch, renderedLiteral)
    }
  }
  return renderedReadme
}

async function deployRecipe(recipePath) {
  assert(fs.existsSync(recipePath), `Recipe file does not exist: ${recipePath}`)
  const recipe = JSON.parse(fs.readFileSync(recipePath, 'utf8'))

  const { form, container_template: containerTemplate, patches, ui } = recipe
  assert(form, 'Recipe must contain a "form" property')
  assert(form.title, 'Recipe form must contain a "title" property')
  assert(form.description, 'Recipe form must contain a "description" property')
  assert(containerTemplate, 'Recipe must contain a "container_template" property')
  assert(patches, 'Recipe must contain a "patches" property')
  assert(recipe.documentation_url, 'Recipe must contain a "documentation_url" property')
  assert(recipe.short_description, 'Recipe must contain a "short_description" property')
  console.log(`===Recipe Deployment Wizard===`)
  console.log(`Deploying recipe: ${form.title}`)
  console.log(`\n${form.description}\n`)

  const inputs = await getInputs(form, ui)
  const output = applyPatches(containerTemplate, inputs, patches)
  const readme = output.readme
  delete output.readme // Remove readme from the output to avoid sending it to the API
  const snakedOutput = snakeAllKeys(output) // Convert all keys to snake_case
  console.log('\nSalad Organization:')
  const org = await promptString()
  if (!org) {
    console.error('Organization is required.')
    return
  }
  console.log('\nSalad Project:')
  const project = await promptString()
  if (!project) {
    console.error('Project is required.')
    return
  }
  console.log(`Creating container group with the following configuration, in org '${org}', project '${project}':`)
  console.log(JSON.stringify(snakedOutput, null, 2))
  const confirmation = await promptBoolean(true)
  process.stdin.destroy()
  if (!confirmation) {
    console.log('Deployment cancelled.')
    return
  }
  let containerGroup
  try {
    containerGroup = await createContainerGroup(org, project, snakedOutput)
    console.log(`Container group created successfully: ${containerGroup.id}`)
  } catch (error) {
    console.error(`Error creating container group: ${error.message}`)
    process.exit(1)
  }

  const readmePath = path.resolve(`./${containerGroup.name}.readme.mdx`)
  containerGroup.apiKey = SALAD_API_KEY // Include API key in output for readme rendering
  try {
    fs.writeFileSync(readmePath, renderReadme(readme, camelAllKeys(containerGroup)))
    console.log(`Readme written to: ${readmePath}`)
  } catch (error) {
    console.error(`Error writing readme: ${error.message}`)
  }

  const url = `https://portal.salad.com/organizations/${org}/projects/${project}/containers/${containerGroup.name}`
  console.log(`\nYou can view the container group at: ${url}`)

  try {
    // open the URL in the default browser
    execSync(`xdg-open "${url}"`, { stdio: 'ignore' })
  } catch (error) {
    console.error(`Failed to open URL in browser: ${error.message}`)
  }
}

if (require.main === module) {
  const recipePath = process.argv[2]
  assert(recipePath, usage)
  deployRecipe(recipePath).catch((error) => {
    console.error(`Error: ${error.message}`)
    process.exit(1)
  })
}

exports.deployRecipe = deployRecipe
