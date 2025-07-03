import { Args, Command, Flags } from '@oclif/core'
import fs from 'fs'
import path from 'path'
import assert from 'assert'
import { execSync } from 'child_process'
import inquirer from 'inquirer'
import { marked } from 'marked'
import cliHtml from 'cli-html'
import ora from 'ora'
import { snakeAllKeys, camelAllKeys } from '../text-utils'

export default class Deploy extends Command {
  static override args = {
    'recipe-file': Args.file({
      description: 'JSON file containing the recipe to deploy',
      required: false,
      exists: true,
    }),
  }
  static override description = 'Deploy a recipe to Salad Cloud'
  static override examples = ['<%= config.bin %> <%= command.id %>']
  static override flags = {
    list: Flags.boolean({
      description: 'interactively choose a recipe to deploy from a list',
      required: false,
      default: false,
      char: 'l',
    }),
    'recipe-dir': Flags.directory({
      description: 'directory containing recipes to list',
      required: false,
      exists: true,
      default: './recipes',
      char: 'd',
    }),
    export: Flags.boolean({
      description: 'Rebuild the recipe.json before deploying',
      required: false,
      default: false,
      char: 'e',
    }),
    'dry-run': Flags.boolean({
      description: 'Show the recipe deployment without actually deploying it',
      required: false,
      default: false,
    }),
  }

  private saladApiKey: string | undefined

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Deploy)
    this.saladApiKey = process.env.SALAD_API_KEY
    if (!flags['dry-run'] && !this.saladApiKey) {
      this.error('SALAD_API_KEY environment variable is not set.')
    }

    let recipeFile = args['recipe-file']
    if (!recipeFile && !flags.list) {
      this.error('You must provide a recipe file or use the --list flag to choose a recipe interactively.')
    } else if (flags.list) {
      const recipeRootDir = flags['recipe-dir'] as string
      recipeFile = await this.promptRecipes(recipeRootDir)
    }

    if (flags.export) {
      const recipeDir = path.dirname(recipeFile!)
      execSync(`npx recipe export ${recipeDir}`)
    }

    await this.deployRecipe(recipeFile!, flags['dry-run'])
  }

  async deployRecipe(recipePath: string, dryRun: boolean): Promise<void> {
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
    this.log(`===Recipe Deployment Wizard===`)
    this.log(`Deploying recipe: ${recipePath}\n\n`)
    this.log(cliHtml(await marked(`# ${form.title}\n${form.description}`)))

    const inputs = await this.getInputs(form, ui)
    Object.assign(inputs, await this.getConstantInputs(containerTemplate))
    const output = this.applyPatches(containerTemplate, inputs, patches)
    const readme = output.readme
    delete output.readme // Remove readme from the output to avoid sending it to the API
    const snakedOutput = snakeAllKeys(output) // Convert all keys to snake_case
    let containerGroup: any = snakedOutput
    if (!dryRun) {
      this.log('\nSalad Organization:')
      const org = (
        await inquirer.prompt([
          {
            type: 'input',
            name: 'org',
            message: 'Enter your Salad organization Name:',
            required: true,
          },
        ])
      ).org
      if (!org) {
        this.error('Organization is required.')
        return
      }
      this.log('\nSalad Project:')
      const project = (
        await inquirer.prompt([
          {
            type: 'input',
            name: 'project',
            message: 'Enter your Salad project Name:',
            required: true,
          },
        ])
      ).project
      if (!project) {
        this.error('Project is required.')
        return
      }
      this.log(`Creating container group with the following configuration, in org '${org}', project '${project}':`)
      this.log(JSON.stringify(snakedOutput, null, 2))
      const confirmation = (
        await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Do you want to proceed with the deployment?',
            default: true,
          },
        ])
      ).confirm
      process.stdin.destroy()
      if (!confirmation) {
        this.log('Deployment cancelled.')
        return
      }

      try {
        containerGroup = await this.createContainerGroup(org, project, snakedOutput)
        containerGroup.apiKey = this.saladApiKey // Include API key in output for readme rendering

        this.log(`Container group created successfully: ${containerGroup.id}`)
      } catch (error: any) {
        this.error(`Error creating container group: ${error.message}`)
      }

      const url = `https://portal.salad.com/organizations/${org}/projects/${project}/containers/${containerGroup.name}`
      this.log(`\nYou can view the container group at: ${url}`)

      try {
        // open the URL in the default browser
        execSync(`xdg-open "${url}"`, { stdio: 'ignore' })
      } catch (error: any) {
        this.error(`Failed to open URL in browser: ${error.message}`)
      }
    } else {
      this.log('Dry run mode enabled. The following container group would be created:')
      this.log(JSON.stringify(snakedOutput, null, 2))
      this.log('No actual deployment will occur.')
      if (containerGroup.networking) {
        containerGroup.networking.dns = 'fake-placeholder-dsf8i7ukj.salad.cloud'
      }
      containerGroup.apiKey = 'thisisatotallyfakeapikeyforreadmegeneration'
    }

    const readmePath = path.resolve(`./${containerGroup.name}.readme.mdx`)

    try {
      fs.writeFileSync(readmePath, this.renderReadme(readme, camelAllKeys(containerGroup)))
      this.log(`Readme written to: ${readmePath}`)
    } catch (error: any) {
      this.error(`Error writing readme: ${error.message}`)
    }
  }

  async getInputs(form: any, ui: any): Promise<Record<string, any>> {
    const input: Record<string, any> = {}
    for (const field in form.properties) {
      const required = form?.required.includes(field) ? '(required) ' : ''
      this.log(`${required}${form.properties[field].title}:\n${form.properties[field].description || ''}`)
      let value: any
      if (form.properties[field].type === 'boolean') {
        value = (
          await inquirer.prompt([
            {
              type: 'confirm',
              name: field,
              message: form.properties[field].title,
              default: form.properties[field].default || false,
            },
          ])
        )[field]
      } else if (form.properties[field].type === 'number') {
        value = (
          await inquirer.prompt([
            {
              type: 'number',
              name: field,
              message: form.properties[field].title,
              default: form.properties[field].default,
            },
          ])
        )[field]
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
        value = (
          await inquirer.prompt([
            {
              type: 'list',
              name: field,
              message: form.properties[field].title,
              choices: enumOptions,
              default: defaultValue,
            },
          ])
        )[field]
        if (usedLabels) {
          // If using labels, map back to original enum values
          const index = enumOptions.indexOf(value)
          if (index !== -1) {
            value = form.properties[field].enum[index]
          } else {
            this.error(`Selected option "${value}" is not valid.`)
          }
        }
      } else if (form.properties[field].type === 'string') {
        value = (
          await inquirer.prompt([
            {
              type: 'input',
              name: field,
              message: form.properties[field].title,
              default: form.properties[field].default || '',
            },
          ])
        )[field]
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
            const subInputs = await this.getInputs(subForm, ui)
            Object.assign(input, subInputs)
            break // Only apply the first matching dependency
          }
        }
      }
    }

    return input
  }

  async getConstantInputs(containerGroup: any): Promise<Record<string, any>> {
    const constantInputs: Record<string, any> = {}
    constantInputs['replicas'] = (
      await inquirer.prompt([
        {
          type: 'number',
          name: 'replicas',
          message: 'Number of replicas',
          default: containerGroup.replicas || 1,
        },
      ])
    ).replicas

    constantInputs['autostartPolicy'] = (
      await inquirer.prompt([
        {
          type: 'confirm',
          name: 'autostartPolicy',
          message: 'Start the container group automatically?',
          default: containerGroup.autostartPolicy ?? true,
        },
      ])
    ).autostartPolicy

    return constantInputs
  }

  setNestedValue(obj: any, path: string[], value: any): any {
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

  applyPatches(containerTemplate: any, inputs: Record<string, any>, patches: any[][]): any {
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
          this.setNestedValue(output, targetField, sourceValue)
        } else if (patch.op === 'add') {
          const targetField = patch.path.split('/').slice(2)
          // Traverse output to find the target field, and add the value
          this.setNestedValue(output, targetField, patch.value)
        }
      }
    }
    return output
  }

  async createContainerGroup(org: string, project: string, containerGroupDefinition: any): Promise<any> {
    const url = `https://api.salad.com/api/public/organizations/${org}/projects/${project}/containers`
    const spinner = ora(
      `Creating container group ${containerGroupDefinition.name} in org '${org}', project '${project}'...`,
    ).start()
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Salad-Api-Key': this.saladApiKey!,
      },
      body: JSON.stringify(containerGroupDefinition),
    })

    if (!response.ok) {
      let body = await response.text()
      try {
        body = JSON.parse(body)
        body = JSON.stringify(body, null, 2)
      } catch (e: any) {}
      spinner.fail(`Failed to create container group: ${response.status} - ${response.statusText}\n${body}`)
      this.error(`Failed to create container group: ${response.status} - ${response.statusText}\n${body}`)
    }
    spinner.succeed(`Container group ${containerGroupDefinition.name} created successfully.`)
    return response.json()
  }

  renderReadme(readme: string, props: Record<string, any>): string {
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

  async promptRecipes(recipeRootDir: string): Promise<string> {
    const recipeDirs = fs.readdirSync(recipeRootDir, {
      withFileTypes: true,
    })
    const recipePaths = recipeDirs
      .filter((dir) => dir.isDirectory())
      .map((dir) => path.join(recipeRootDir, dir.name, 'recipe.json'))
      .filter((file) => fs.existsSync(file))
    const recipes = recipePaths.map((recipePath) => {
      try {
        const content = fs.readFileSync(recipePath, 'utf-8')
        return { content: JSON.parse(content), path: recipePath }
      } catch (error: any) {
        this.error(`Error reading recipe at ${recipePath}: ${error.message}`)
      }
    })
    const recipeFile = (
      await inquirer.prompt([
        {
          type: 'list',
          name: 'recipe',
          message: `Choose a recipe to deploy (${recipes.length} available):`,
          choices: recipes.map((recipe) => {
            return {
              name: recipe.content.form.title,
              value: recipe.path,
            }
          }),
          default: recipes[0].path,
          pageSize: 10, // Show 10 recipes at a time
        },
      ])
    ).recipe
    return recipeFile
  }
}
