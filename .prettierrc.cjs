/** @type {import('prettier').Options} */
module.exports = {
  endOfLine: 'auto',
  overrides: [
    {
      files: ['*.yml', '*.yaml'],
      options: {
        singleQuote: false,
      },
    },
  ],
  printWidth: 120,
  semi: false,
  singleQuote: true,
  trailingComma: 'all'
}
