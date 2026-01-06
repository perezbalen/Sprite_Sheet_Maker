module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react-hooks/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react-refresh'],
  settings: {
    react: {
      version: '18.3'
    }
  },
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
  }
}
