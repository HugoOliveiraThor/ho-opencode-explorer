# HO OpenCode Explorer — Commands Tab

**Date:** 2026-06-15
**Status:** Design approved
**Depends on:** Existing Skills tab implementation (branch `main`)

## Overview

Add a **Commands** tab to the HO OpenCode Explorer VS Code extension sidebar, alongside the existing Skills tab. The Commands tab browses OpenCode slash commands defined either as `.md` files in `commands/` directories or inline in `opencode.json`.

## Architecture

### Views in the Sidebar Container

The `ho-opencode-explorer` view container (activity bar) gets 3 views:

| View ID                | Name     | Type    | Description                                                                         |
| ---------------------- | -------- | ------- | ----------------------------------------------------------------------------------- |
| `ho-opencode-skills`   | Skills   | tree    | Existing — unchanged                                                                |
| `ho-opencode-commands` | Commands | tree    | **New** — browses commands                                                          |
| `ho-opencode-detail`   | Details  | webview | **Renamed** from `ho-opencode-skill-detail` — unified panel for Skills and Commands |

VS Code renders native tabs "Skills" / "Commands" at the top of the sidebar. The "Details" panel sits below and updates based on the active tree selection.

### New Modules

```
src/
├── scanner/
│   ├── SkillsScanner.ts        # existing — unchanged
│   └── CommandsScanner.ts      # NEW — scans command sources
├── tree/
│   ├── SkillTreeDataProvider.ts # existing — unchanged
│   └── CommandsTreeDataProvider.ts # NEW — TreeDataProvider for commands
├── panel/
│   └── DetailPanel.ts          # RENAMED from SkillDetailPanel — handles Skill | Command
├── toggle/
│   └── SkillToggleManager.ts   # existing — unchanged
├── update/
│   └── UpdateService.ts        # existing — unchanged
├── types.ts                    # MODIFIED — adds Command, CommandSource
└── extension.ts                # MODIFIED — registers second TreeView
```

Nothing is removed. Skills continue working identically.

## Data Model

### Types (`src/types.ts` additions)

```typescript
type CommandSource = 'file' | 'json';

interface Command {
  name: string;
  description: string;
  source: CommandSource; // 'file' or 'json'
  path?: string; // file path (.md files) or opencode.json path (json)
  template?: string; // prompt template body
  jsonPath?: string; // JSON key path, e.g. "command.gsd-new-project" (json only)
  error?: string; // parse error message
}

interface CommandGroup {
  source: CommandSource;
  label: string; // "From File" or "From opencode.json"
  commands: Command[];
}
```

Existing types (`Skill`, `SkillGroup`, `SkillSource`) remain unchanged.

## CommandsScanner

Scans 3 sources:

| Source            | Path                                                   | Type   | Scan Method                                 |
| ----------------- | ------------------------------------------------------ | ------ | ------------------------------------------- |
| Global file-based | `~/.config/opencode/commands/*.md`                     | `file` | `fs.readdir`, parse YAML frontmatter + body |
| Local file-based  | `.opencode/commands/*.md` (relative to workspace root) | `file` | `fs.readdir`, parse YAML frontmatter + body |
| Inline JSON       | `~/.config/opencode/opencode.json` → `command` key     | `json` | `JSON.parse`, extract each entry            |

### File-based Command Format

Unlike skills (where `name` comes from frontmatter), **the command name is the filename without `.md`**. Example: `gsd-new-project.md` → command name is `gsd-new-project`.

```markdown
## <!-- ~/.config/opencode/commands/gsd-new-project.md -->

## description: Inicie um projeto do zero definindo stack e objetivos

Execute o comando /gsd-new-project do GSD (Get Shit Done).
Use o workflow em ~/.config/opencode/get-shit-done/workflows/new-project.md
```

- **Filename** (minus `.md`) determines `Command.name`
- **Frontmatter** provides `description` (optional — defaults to `""` if absent)
- **Body** (everything after `---`) is the `template`
- No `enabled` field — commands don't have enable/disable toggles

### Inline JSON Command Format

```json
{
  "command": {
    "gsd-new-project": {
      "description": "Inicie um projeto do zero definindo stack e objetivos",
      "template": "Execute o comando /gsd-new-project..."
    }
  }
}
```

- `description` maps to `Command.description`
- `template` maps to `Command.template`
- `jsonPath` is set to `"command.<name>"`

### Deduplication

If the same command name exists in both a `.md` file AND `opencode.json`, both appear — one in "From File", one in "From opencode.json". The group label and icon make the source clear. No merging.

### Return Type

```typescript
interface CommandsScanResult {
  groups: CommandGroup[]; // always 2: [fileGroup, jsonGroup]
  total: number;
  errors: string[];
}
```

## CommandsTreeDataProvider

Implements `vscode.TreeDataProvider<CommandTreeNode>`.

### Tree Structure

```
COMMANDS
├── 📁 From File (N)
│   ├── 📄 <name>        <-- file commands
│   └── ...
└── 📁 From opencode.json (M)
    ├── ⚙️ <name>        <-- inline JSON commands
    └── ...
```

### TreeNode Types

```typescript
type CommandTreeNode = CommandCategoryNode | CommandNode;

interface CommandCategoryNode {
  type: 'category';
  source: CommandSource;
  label: string;
  count: number;
}

interface CommandNode {
  type: 'command';
  command: Command;
}
```

### Features

- **No checkboxes** — commands don't have enable/disable
- **Icons**: `$(file)` for file-based, `$(json)` for JSON inline
- **contextValue**: `'command'` (for context menu contributions)
- **Tooltip**: shows `description` on hover
- **Empty states**: "No commands found" for empty groups
- **Refresh**: `dataProvider.refresh()` re-scans and fires `onDidChangeTreeData`

### TreeView Configuration (in `extension.ts`)

```typescript
const commandsTree = vscode.window.createTreeView('ho-opencode-commands', {
  treeDataProvider: commandsDataProvider,
  showCollapseAll: true,
  canSelectMany: false,
});
```

## DetailPanel (unified, renamed from SkillDetailPanel)

File renamed from `src/panel/SkillDetailPanel.ts` to `src/panel/DetailPanel.ts`. The class is renamed to `DetailPanel` and implements `vscode.WebviewViewProvider`.

### API

```typescript
class DetailPanel implements vscode.WebviewViewProvider {
  resolveWebviewView(webviewView, context, token): void;
  showSkill(skill: Skill): void; // existing — unchanged behavior
  showCommand(command: Command): void; // NEW
  clear(): void; // existing
  getEmptyHtml(): string; // existing — updated to mention Commands
}
```

### showCommand() — File-based Command

```html
<h3>{name}</h3>
<span class="badge badge-type">COMMAND</span>
<span class="badge badge-file">File</span>
<p class="description">{description}</p>

<div class="field">
  <label>SOURCE</label>
  <code>{path}</code>
</div>

<div class="field">
  <label>TEMPLATE</label>
  <pre>{template}</pre>
</div>

<button onclick="openFile('{path}')">Open File</button>
<button onclick="copyPath('{path}')">Copy Path</button>
```

### showCommand() — Inline JSON Command

```html
<h3>{name}</h3>
<span class="badge badge-type">COMMAND</span>
<span class="badge badge-json">JSON config</span>
<p class="description">{description}</p>

<div class="field">
  <label>TEMPLATE</label>
  <pre>{template}</pre>
</div>

<div class="field">
  <label>DEFINED IN</label>
  <code>{path} → {jsonPath}</code>
</div>

<button onclick="openFile('{path}')">Open opencode.json</button>
<button onclick="copyPath('{path}')">Copy Path</button>
```

### Webview Messages

Add new message types for commands:

```typescript
type WebviewMessage =
  | { command: 'openFile'; path: string }
  | { command: 'copyPath'; path: string }
  | { command: 'openJsonAt'; filePath: string; jsonPath: string }; // NEW
```

### Styling

All CSS uses VS Code CSS variables (`--vscode-*`). No external frameworks.

New badge classes:

- `.badge-command` — type indicator (blue-grey)
- `.badge-file` — source: file (green)
- `.badge-json` — source: inline JSON (orange/amber)

## extension.ts Changes

### Registration

```typescript
export function activate(context: vscode.ExtensionContext) {
  // === Existing ===
  const scanner = new SkillsScanner();
  const toggleManager = new SkillToggleManager();
  const skillsProvider = new SkillTreeDataProvider(scanner, toggleManager);
  const skillsTree = vscode.window.createTreeView('ho-opencode-skills', { ... });
  const detailPanel = new DetailPanel();  // renamed

  // === NEW ===
  const commandsScanner = new CommandsScanner();
  const commandsProvider = new CommandsTreeDataProvider(commandsScanner);
  const commandsTree = vscode.window.createTreeView('ho-opencode-commands', { ... });

  // === Detail Panel ===
  // Single webview, shared between both trees
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('ho-opencode-detail', detailPanel)
  );

  // On Skills tree selection → detailPanel.showSkill(skill)
  // On Commands tree selection → detailPanel.showCommand(command)
}
```

### File Watchers

Add 3 new watchers (in addition to existing 4 for skills):

| Watch target                       | Purpose                  |
| ---------------------------------- | ------------------------ |
| `~/.config/opencode/commands/`     | Global command .md files |
| `.opencode/commands/` (workspace)  | Local command .md files  |
| `~/.config/opencode/opencode.json` | Inline JSON commands     |

All watchers use 500ms debounce. When opencode.json changes, both the commands AND skills trees refresh (since it also holds skill registration).

### Activation Events

```json
"activationEvents": [
  "onView:ho-opencode-skills",
  "onView:ho-opencode-commands"
]
```

### Deactivation

`deactivate()` clears new watchers and nulls out new references. No new subscription pattern needed — all disposables are pushed to `context.subscriptions`.

## package.json Changes

### Views

```json
"views": {
  "ho-opencode-explorer": [
    { "id": "ho-opencode-skills",   "name": "Skills",    "type": "tree" },
    { "id": "ho-opencode-commands", "name": "Commands",  "type": "tree" },
    { "id": "ho-opencode-detail",   "name": "Details",   "type": "webview" }
  ]
}
```

`ho-opencode-skill-detail` is removed and replaced by `ho-opencode-detail`.

### Menus

Add context menu for command items:

```json
"view/item/context": [
  { "command": "ho-opencode-explorer.openSkill", "when": "viewItem == skill" },
  { "command": "ho-opencode-explorer.openCommand", "when": "viewItem == command" }
]
```

### Commands

Add new VS Code commands:

| Command ID                             | Title             | Icon         | Location                                       |
| -------------------------------------- | ----------------- | ------------ | ---------------------------------------------- |
| `ho-opencode-explorer.refreshCommands` | Refresh Commands  | `$(refresh)` | `view/title` of `ho-opencode-commands`         |
| `ho-opencode-explorer.openCommand`     | Open Command File | —            | `view/item/context` when `viewItem == command` |

## Test Plan

New test files:

| File                                          | What it tests                                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/test/suite/commandsScanner.test.ts`      | Scanning both sources, parsing .md frontmatter, parsing opencode.json inline commands, error handling, deduplication |
| `src/test/suite/commandsTreeProvider.test.ts` | Tree structure, categories, node properties, empty state                                                             |
| `src/test/suite/detailPanel.test.ts`          | Updated to test showCommand() for both file and json sources                                                         |

### Test Fixtures

New fixture directories:

```
src/test/fixtures/
├── skills/          # existing — unchanged
└── commands/
    ├── valid-file/
    │   └── COMMAND.md
    ├── no-frontmatter/
    │   └── COMMAND.md
    └── opencode-json/
        └── opencode.json          # sample with command definitions
```

## Non-Goals

- **Enable/disable toggle for commands** — commands don't have an `enabled` field in the OpenCode schema
- **Editing commands inline** — too risky to edit opencode.json programmatically
- **Creating new commands via the extension** — out of scope for v1
- **MCP Prompt commands** — OpenCode auto-maps MCP prompts as commands; not scanning those

## Migration Notes

- The webview view `ho-opencode-skill-detail` is renamed to `ho-opencode-detail`
- `SkillDetailPanel` is renamed to `DetailPanel`
- Existing settings (if any reference `ho-opencode-skill-detail`) need no migration — no settings exist yet
- The `.vsix` size will increase by ~20-30KB (new scanner + tree provider modules)
