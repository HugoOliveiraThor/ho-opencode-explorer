# Contributing to HO OpenCode Explorer

## Development Setup

```bash
git clone https://github.com/HugoOliveiraThor/ho-opencode-explorer.git
cd ho-opencode-explorer
npm install
npm run compile
```

Press F5 in VS Code to launch the Extension Development Host.

## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run compile` | Build the extension                  |
| `npm run watch`   | Build and watch for changes          |
| `npm run lint`    | Run ESLint                           |
| `npm run format`  | Format code with Prettier            |
| `npm test`        | Run tests                            |
| `npm run release` | Create release with standard-version |

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/). All commits must follow this format:

```
feat: add new feature
fix: resolve bug
docs: update documentation
test: add tests
chore: maintenance
```

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes with conventional commits
4. Ensure tests pass (`npm test`)
5. Open a PR against `main`
