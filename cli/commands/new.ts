import { Args, Command } from '@oclif/core'
import fs from 'fs/promises'

export default class New extends Command {
  static override args = {
    'recipe-dir': Args.directory({
      description: 'directory to create the new recipe in',
      required: true,
      exists: false,
    }),
  }
  static override description = 'create a new boilerplate recipe'
  static override examples = ['<%= config.bin %> <%= command.id %>']

  public async run(): Promise<void> {
    const { args } = await this.parse(New)
    await this.newRecipe(args['recipe-dir'])
  }

  async newRecipe(directory: string): Promise<void> {
    this.log(`Creating new recipe in ${directory}`)

    await fs.mkdir(directory, { recursive: true })

    const readmeContent = `# Recipe Readme
This is a placeholder for the recipe readme, visible from the deployed container group page. Replace this with your actual content.
  `

    const descriptionContent = `# Recipe Description
This is a placeholder for the recipe description, visible from the recipe form. Replace this with your actual content.
  `

    const formContent = {
      title: 'My Recipe',
      description: '$replace',
      type: 'object',
      required: ['container_group_name'],
      properties: {
        container_group_name: {
          title: 'Container Group Name',
          description:
            'Must be 2-63 lowercase letters, numbers, or hyphens. Cannot start with a number or start or end with a hyphen.',
          type: 'string',
          maxLength: 63,
          minLength: 2,
          pattern: '^[a-z][a-z0-9-]{0,61}[a-z0-9]$',
          default: '',
        },
        networking_auth: {
          title: 'Require Container Gateway Authentication',
          description:
            'When enabled, requests must include a SaladCloud API Key. When disabled, any anonymous request will be allowed.',
          type: 'boolean',
          default: true,
        },
      },
    }

    const containerGroupContent = {
      autostartPolicy: true,
      container: {
        environmentVariables: {},
        image: '',
        imageCaching: true,
        priority: 'high',
        resources: {
          cpu: 1,
          memory: 1024, // 1 GB
          gpuClasses: [
            'a5db5c50-cbcb-4596-ae80-6a0c8090d80f', // RTX 3090
          ],
          storageAmount: 1073741824, // 1 GB
        },
      },
      name: '',
      networking: {
        auth: true,
        clientRequestTimeout: 100000,
        loadBalancer: 'least_number_of_connections',
        port: 3000,
        protocol: 'http',
        serverResponseTimeout: 100000,
        singleConnectionLimit: false,
      },
      replicas: 3,
      restartPolicy: 'always',
      readme: '$replace',
      readinessProbe: {
        failureThreshold: 1,
        http: {
          headers: [],
          path: '/ready',
          port: 3000,
          scheme: 'http',
        },
        initialDelaySeconds: 0,
        periodSeconds: 3,
        successThreshold: 1,
        timeoutSeconds: 10,
      },
    }

    const patches = [
      [
        {
          op: 'copy',
          from: '/input/autostart_policy',
          path: '/output/autostartPolicy',
        },
        {
          op: 'copy',
          from: '/input/replicas',
          path: '/output/replicas',
        },
        {
          op: 'copy',
          from: '/input/container_group_name',
          path: '/output/name',
        },
        {
          op: 'copy',
          from: '/input/networking_auth',
          path: '/output/networking/auth',
        },
      ],
    ]

    const miscContent = {
      ui: {},
      documentation_url: '',
      short_description: '',
      workload_types: [],
    }

    await this.writeFile(`${directory}/container_template.readme.mdx`, readmeContent)
    await this.writeFile(`${directory}/form.json`, JSON.stringify(formContent, null, 2))
    await this.writeFile(`${directory}/container-group.json`, JSON.stringify(containerGroupContent, null, 2))
    await this.writeFile(`${directory}/form.description.mdx`, descriptionContent)
    await this.writeFile(`${directory}/misc.json`, JSON.stringify(miscContent, null, 2))
    await this.writeFile(`${directory}/patches.json`, JSON.stringify(patches, null, 2))

    this.log(`New recipe created in ${directory}`)
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.log(`Writing ${path}`)
    return fs.writeFile(path, content)
  }
}
