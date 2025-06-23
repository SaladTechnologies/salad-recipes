#! /usr/bin/env node

import {execute} from '@oclif/core'

process.stdout.write('\u001B[2J\u001B[0;0f') // Clear the console
await execute({dir: import.meta.url})
