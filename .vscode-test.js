const { defineConfig } = require('@vscode/test-cli');

module.exports = defineConfig({
  files: 'out/test/suite/**/*.test.js',
  version: '1.124.2',
  mocha: {
    ui: 'tdd',
    timeout: 20000,
  },
});
