import { Args, Command, Flags } from '@oclif/core'
import fs from 'fs/promises'
import { execSync } from 'child_process'
import path from 'path'

export default class Export extends Command {
  static override args = {
    'recipe-dir': Args.directory({
      description: 'directory to export the recipe from',
      required: true,
      exists: true,
    }),
    'recipe-json': Args.string({
      description: 'file to write the exported recipe JSON to',
      required: true,
      default: 'recipe.json',
    }),
  }
  static override description = 'Export a recipe to a JSON file'
  static override examples = ['<%= config.bin %> <%= command.id %>']

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Export)
    const directory = args['recipe-dir']
    const recipeJson = path.resolve(directory, args['recipe-json'])
    await this.exportRecipe(directory, recipeJson)
  }

  async exportRecipe(directory: string, recipeJson: string): Promise<void> {
    this.log(`Exporting recipe from ${directory} to ${recipeJson}`)

    try {
      const containerGroup = JSON.parse(await fs.readFile(`${directory}/container-group.json`, 'utf8'))
      containerGroup.readme = await fs.readFile(`${directory}/container_template.readme.mdx`, 'utf8')

      const form = JSON.parse(await fs.readFile(`${directory}/form.json`, 'utf8'))
      form.description = await fs.readFile(`${directory}/form.description.mdx`, 'utf8')

      const patches = JSON.parse(await fs.readFile(`${directory}/patches.json`, 'utf8'))

      const misc = JSON.parse(await fs.readFile(`${directory}/misc.json`, 'utf8'))

      for (let i = 0; i < patches.length; i++) {
        const patchArray = patches[i]
        for (let j = 0; j < patchArray.length; j++) {
          const patch = patchArray[j]
          if (patch.op === 'add' && patch.path === '/output/readme' && patch.value === '$replace') {
            const readmePatch = `${directory}/patches.${i}.${j}.readme.mdx`
            patches[i][j].value = await fs.readFile(readmePatch, 'utf8')
          }
        }
      }

      const recipe = {
        container_template: containerGroup,
        form: form,
        patches: patches,
        ...misc,
      }
      await fs.writeFile(recipeJson, JSON.stringify(recipe, null, 2))
      execSync(`npx prettier --write ${recipeJson}`, { stdio: 'inherit' })
    } catch (err) {
      console.error(`Error reading or writing recipe:`, err)
      process.exit(1)
    }
  }
}
