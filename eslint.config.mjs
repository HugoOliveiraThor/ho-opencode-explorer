import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'esbuild.config.js',
      '.vscode-test.js',
      'commitlint.config.js',
    ],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'warn',
    },
  },
  {
    files: ['src/test/**/*.ts'],
    languageOptions: {
      globals: {
        suite: 'readonly',
        test: 'readonly',
        setup: 'readonly',
        teardown: 'readonly',
        suiteSetup: 'readonly',
        suiteTeardown: 'readonly',
      },
    },
  },
];
