# CLAUDE.md

This file provides guidance for Claude Code when working with the salad-recipes repository.

## Repository Overview

This is the **Salad Recipes** repository - a collection of pre-configured container group templates for deploying AI models and applications on SaladCloud. Recipes enable users to deploy AI workloads (LLMs, image generation, video models, mining applications) without manual infrastructure configuration.

## Project Structure

```
salad-recipes/
├── recipes/           # Modern recipe definitions (primary)
├── src/               # Legacy recipe source (deprecated, do not modify)
├── cli/               # TypeScript CLI tool for recipe management
├── scripts/           # Utility scripts for API interaction
├── benchmark/         # Performance benchmarking tools (deprecated)
├── bin/               # CLI entry points
└── .github/workflows/ # CI/CD for Docker image building
```

## Recipe Structure

Each recipe in `recipes/<name>/` contains:
- **container-group.json** - Container configuration (resources, networking, probes, env vars). Use `"readme": "$replace"` as placeholder.
- **form.json** - JSON Schema for deployment form UI. Use `"description": "$replace"` as placeholder.
- **form.description.mdx** - Pre-deployment description (replaces `$replace` in form.json)
- **container_template.readme.mdx** - Default post-deployment readme (replaces `$replace` in container-group.json)
- **patches.json** - JSON Patch operations mapping form inputs to config
- **patches.N.M.readme.mdx** - Variant-specific readmes for patches with `{"op": "add", "path": "/output/readme", "value": "$replace"}`
- **misc.json** - Metadata (docs URL, short_description, workload_types, ui settings)
- **recipe.json** - Compiled single-file format (generated via export)

## Key Commands

```bash
# Install dependencies
npm install

# Create new recipe (interactive, prompts for Container Gateway usage)
npx recipe new recipes/<name>

# Create recipe from existing container group (prompts for org/project)
npx recipe new recipes/<name> --from-container-group <container-group-name>

# Export recipe directory to recipe.json (writes to recipes/<name>/recipe.json)
npx recipe export recipes/<name>

# Import recipe.json into directory structure
npx recipe import recipes/<name>/recipe.json

# List available recipes
npx recipe list
npx recipe list recipes

# Deploy recipe from file
npx recipe deploy recipes/<name>/recipe.json

# Deploy with interactive recipe selection
npx recipe deploy --list

# Re-export before deploying
npx recipe deploy recipes/<name>/recipe.json --export

# Dry run deployment (shows config without deploying)
npx recipe deploy recipes/<name>/recipe.json --dry-run
```

## Environment Variables

- `SALAD_API_KEY` - Required for API operations
- `SALAD_ORGANIZATION_NAME` - Optional default org
- `SALAD_PROJECT_NAME` - Optional default project

## Conventions

### Naming
- Recipe directories: kebab-case (`ollama`, `comfyui`, `nock-gpu-miner`)
- JSON fields: snake_case in API, camelCase internally
- Environment variables: UPPERCASE_SNAKE_CASE

### Code Style
- Prettier: 120 char width, single quotes, no semicolons
- TypeScript: ES2016 target, CommonJS modules

### Form Patterns
- Required fields: omit default, set minLength >= 1
- Cannot modify per-replica costs (GPU, CPU, memory) in forms
- Always prompted: replica count, autostart policy

### Patch Format (RFC 6902-like)
Supported operations: `test`, `copy`, `add`, `remove`
```json
[
  [
    { "op": "test", "path": "/input/field_name", "value": "expected_value" },
    { "op": "copy", "from": "/input/field_name", "path": "/output/target" },
    { "op": "add", "path": "/output/field", "value": "static_value" },
    { "op": "remove", "path": "/output/field_to_remove" }
  ]
]
```
- `test`: If value doesn't match, skip remaining patches in that block
- `copy`: Copy input field value to output path
- `add`: Add static value to output (use `"$replace"` for readme patches)
- `remove`: Remove field from output

## Development Workflow

1. Create recipe in `recipes/<name>/`
2. Populate form.json, patches.json, container-group.json
3. Write .mdx documentation files
4. Export with `npx recipe export recipes/<name>`
5. Test with `npx recipe deploy recipes/<name>/recipe.json --dry-run`
6. Create PR for review

## Tech Stack

- Node.js v24.2.0 (see .nvmrc)
- TypeScript 5.8.x
- Docker containers
- JSON Schema for validation
- MDX for dynamic documentation
- GitHub Actions for CI/CD

## Recipe Validation Requirements

A valid recipe.json must contain:
- `form` with `title` and `description`
- `container_template` with `readme`
- `patches` (array of arrays)
- `documentation_url`
- `short_description`

## Important Notes

- The `src/` directory is deprecated - do not add new recipes there
- All new recipes go in `recipes/`
- Recipe.json is the compiled format; edit the source files, not recipe.json directly
- Docker images are published to ghcr.io via GitHub Actions
- The `$replace` placeholder in container-group.json and form.json is replaced with .mdx file contents during export
