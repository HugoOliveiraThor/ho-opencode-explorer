# HO OpenCode Explorer

[![CI](https://github.com/ho/ho-opencode-explorer/actions/workflows/ci.yml/badge.svg)](https://github.com/ho/ho-opencode-explorer/actions/workflows/ci.yml)
[![Version](https://img.shields.io/visual-studio-marketplace/v/ho.ho-opencode-explorer)](https://marketplace.visualstudio.com/items?itemName=ho.ho-opencode-explorer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Browse and manage OpenCode skills directly from your VS Code sidebar.

## Features

- **Browse Skills:** View all global and local OpenCode skills in a native tree view
- **Enable/Disable:** Toggle skills on/off by clicking checkboxes — edits SKILL.md frontmatter
- **Skill Details:** Click any skill to see its description, file path, and source in the detail panel
- **Auto-Update:** File watchers keep the view in sync when skills are added, removed, or modified
- **Version Check:** Built-in update checker notifies you when a new version is available

## Installation

Search for "HO OpenCode Explorer" in the VS Code Extensions view or install via:

```
ext install ho.ho-opencode-explorer
```

## Usage

1. Click the HO OpenCode Explorer icon in the activity bar (left sidebar)
2. Browse skills organized by **Global Skills** and **Local Skills**
3. Click a checkbox to enable/disable a skill
4. Click a skill name to view details in the bottom panel
5. Use the ↻ button in the header to check for updates

## Requirements

- VS Code 1.85.0 or higher
- OpenCode skills installed in the standard directories

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT — see [LICENSE](LICENSE) for details.
