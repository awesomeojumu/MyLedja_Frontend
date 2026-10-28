const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', '.expo/*', 'node_modules/*', 'coverage/*'] },
  {
    files: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
    ignores: ['src/config/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Read configuration through src/config only.' },
      ],
      'no-restricted-globals': ['error', { name: 'parseFloat', message: 'Use src/money for amounts.' }],
    },
  },
  {
    files: ['**/__tests__/**', 'test/**'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]);
