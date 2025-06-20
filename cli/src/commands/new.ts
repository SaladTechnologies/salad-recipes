import { Args, Command, Flags } from '@oclif/core'
import fs from 'fs/promises'
import ora from 'ora'
import inquirer from 'inquirer'
import { camelAllKeys } from '../text-utils'

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
  static override flags = {
    'from-container-group': Flags.string({
      description: 'create a new recipe from an existing container group',
      required: false,
    }),
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(New)
    await this.newRecipe(args['recipe-dir'], flags['from-container-group'])
  }

  async newRecipe(directory: string, fromContainerGroup?: string): Promise<void> {
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

    let containerGroupContent: any
    if (fromContainerGroup) {
      this.log(`Creating recipe from existing container group: ${fromContainerGroup}`)
      const org = (
        await inquirer.prompt({
          name: 'org',
          type: 'input',
          message: 'Enter your organization name:',
          required: true,
        })
      ).org
      const project = (
        await inquirer.prompt({
          name: 'project',
          type: 'input',
          message: 'Enter your project name:',
          required: true,
        })
      ).project
      containerGroupContent = await this.getContainerGroup(org, project, fromContainerGroup)
      if (containerGroupContent) {
        containerGroupContent = this.normalizeContainerGroup(containerGroupContent)
      }
    }

    if (!containerGroupContent) {
      this.log('Creating new container group content from template')
      containerGroupContent = {
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

  normalizeContainerGroup(containerGroup: any): any {
    const { container, restart_policy, networking, readiness_probe, startup_probe, liveness_probe, name } =
      containerGroup

    delete container.size
    delete container.hash
    container.priority = 'high'

    let newDef: any = {
      name: name,
      display_name: name,
      readme: '$replace',
      container,
      autostart_policy: true,
      restart_policy,
      replicas: 3,
      readiness_probe,
      startup_probe,
      liveness_probe,
    }
    if (networking) {
      delete networking.dns
      newDef.networking = networking
    }
    newDef = camelAllKeys(newDef)
  }

  async getContainerGroup(org: string, project: string, containerGroupName: string): Promise<any> {
    const { SALAD_API_KEY } = process.env
    if (!SALAD_API_KEY) {
      this.error('SALAD_API_KEY environment variable is not set.')
    }
    const spinner = ora(`Fetching container group ${containerGroupName}...`).start()
    try {
      // Simulate fetching the container group
      const url = `https://api.salad.com/api/public/organizations/${org}/projects/${project}/containers/${containerGroupName}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Salad-Api-Key': SALAD_API_KEY,
        },
      })
      if (!response.ok) {
        const body = await response.text()
        spinner.fail(`Failed to fetch container group: ${body}`)
        this.error(`Failed to fetch container group: ${response.statusText}`)
      }
      spinner.succeed(`Fetched container group ${containerGroupName}`)
      return response.json()
    } catch (error) {
      spinner.fail(`Failed to fetch container group ${containerGroupName}`)
      throw error
    }
  }
}
