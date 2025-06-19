import { Args, Command, Flags } from '@oclif/core'
import fs from 'fs/promises'
import path from 'path'

export default class Import extends Command {
  static override args = {
    'recipe-json': Args.file({
      description: 'JSON file containing the recipe to import',
      required: true,
      exists: true,
    }),
    'recipe-dir': Args.directory({
      description: 'Directory to import the recipe into',
      required: false,
      exists: false,
      default: '.',
    }),
  }
  static override description = 'Import a recipe from a JSON file'
  static override examples = ['<%= config.bin %> <%= command.id %>']

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Import)
    const recipeJson = args['recipe-json']
    const directory = args['recipe-dir'] ? args['recipe-dir'] : path.dirname(recipeJson)
    await this.importRecipe(recipeJson, directory)
  }

  async importRecipe(recipeJson: string, directory: string): Promise<void> {
    this.log(`Importing recipe from ${recipeJson} to ${directory}`)

    await fs.mkdir(directory, { recursive: true })

    try {
      const recipeData = await fs.readFile(recipeJson, 'utf8')
      const recipe = JSON.parse(recipeData)

      const containerGroup = recipe.container_template
      const readme = containerGroup.readme
      containerGroup.readme = '$replace'

      const form = recipe.form
      const description = form.description
      form.description = '$replace'

      const readmePath = `${directory}/container_template.readme.mdx`
      const formPath = `${directory}/form.json`
      const containerGroupPath = `${directory}/container-group.json`
      const descriptionPath = `${directory}/form.description.mdx`

      this.log(`Writing files to ${directory}`)
      await this.writeFile(readmePath, readme)
      await this.writeFile(formPath, JSON.stringify(form, null, 2))
      await this.writeFile(containerGroupPath, JSON.stringify(containerGroup, null, 2))
      await this.writeFile(descriptionPath, description)

      const miscPath = `${directory}/misc.json`
      const { ui, documentation_url, short_description, workload_types } = recipe
      const misc = {
        ui: ui || {},
        documentation_url: documentation_url || '',
        short_description: short_description || '',
        workload_types: workload_types || [],
      }
      await this.writeFile(miscPath, JSON.stringify(misc, null, 2))

      for (let i = 0; i < recipe.patches.length; i++) {
        const patches = recipe.patches[i]
        for (let j = 0; j < patches.length; j++) {
          const patch = patches[j]
          if (patch.op === 'add' && patch.path === '/output/readme') {
            const outputReadmePath = `${directory}/patches.${i}.${j}.readme.mdx`
            await this.writeFile(outputReadmePath, patch.value)
            recipe.patches[i][j].value = '$replace'
          }
        }
      }
      const patchesPath = `${directory}/patches.json`
      await this.writeFile(patchesPath, JSON.stringify(recipe.patches, null, 2))
    } catch (err) {
      this.error(`Error reading or writing recipe:`, err)
      process.exit(1)
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.log(`Writing ${path}`)
    return fs.writeFile(path, content)
  }
}
