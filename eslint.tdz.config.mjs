import tsParser from './node_modules/@typescript-eslint/parser/dist/index.js';
export default [
  {
    files: ['src/components/PublicScoreboard.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-use-before-define': ['error', { variables: true, functions: false, classes: false }],
    },
  },
];
