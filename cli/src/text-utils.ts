import assert from 'assert'

export function camelToSnakeCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

export function snakeAllKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(snakeAllKeys)
  } else if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => {
        if (key === 'environmentVariables') {
          return [camelToSnakeCase(key), value] // Keep environmentVariables as is
        }
        return [camelToSnakeCase(key), snakeAllKeys(value)]
      }),
    )
  }
  return obj
}

export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase())
}

export function camelAllKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(camelAllKeys)
  } else if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => {
        if (key === 'environment_variables') {
          return [snakeToCamel(key), value] // Keep environmentVariables as is
        }
        return [snakeToCamel(key), camelAllKeys(value)]
      }),
    )
  }
  return obj
}

export function validateRecipeJson(recipe: any): boolean {
  if (!recipe || typeof recipe !== 'object') {
    return false
  }

  const { form, container_template: containerTemplate, patches, ui } = recipe

  assert(form, 'Recipe must contain a "form" property')
  assert(form.title, 'Recipe form must contain a "title" property')
  assert(form.description, 'Recipe form must contain a "description" property')
  assert(containerTemplate, 'Recipe must contain a "container_template" property')
  assert(containerTemplate.readme, 'Recipe container_template must contain a "readme" property')
  assert(patches, 'Recipe must contain a "patches" property')
  assert(Array.isArray(patches), 'Recipe "patches" property must be an array')
  for (const patch of patches) {
    assert(Array.isArray(patch), 'Each patch in "patches" must be an array')
  }
  assert(recipe.documentation_url, 'Recipe must contain a "documentation_url" property')
  assert(recipe.short_description, 'Recipe must contain a "short_description" property')

  return true
}
