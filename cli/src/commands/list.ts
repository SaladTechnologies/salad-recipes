import { Args, Command } from '@oclif/core'
import fs from 'fs/promises'
import path from 'path'

export default class List extends Command {
  static override args = {
    directory: Args.directory({
      description: 'directory containing recipes to list',
      exists: true,
      required: true,
      default: './recipes',
    }),
  }
  static override description = 'List all recipes in a specified directory'
  static override examples = ['<%= config.bin %> <%= command.id %>']

  public async run(): Promise<void> {
    const { args } = await this.parse(List)

    const directory = path.resolve(args.directory)
    this.log(`Listing recipes in directory: ${directory}`)

    try {
      const recipeDirs = await fs.readdir(directory, {
        withFileTypes: true,
      })
      const recipePaths = recipeDirs
        .filter((dir) => dir.isDirectory())
        .map((dir) => path.join(directory, dir.name, 'recipe.json'))
      const recipes = await Promise.all(
        recipePaths.map(async (recipePath) => {
          try {
            const content = await fs.readFile(recipePath, 'utf-8')
            return JSON.parse(content)
          } catch (error: any) {
            this.error(`Error reading recipe at ${recipePath}: ${error.message}`)
          }
        }),
      )

      this.log('Recipes found:')
      recipes.forEach((recipe) => {
        if (recipe) {
          this.log(`- ${recipe.form.title}`)
        }
      })
    } catch (error: any) {
      this.error(`Error reading directory: ${error.message}`)
    }
  }
}
