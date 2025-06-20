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
