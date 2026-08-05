# HO OpenCode Explorer — Content Explorers Expansion (Agents, MCP, Prompts)

**Date:** 2026-08-05
**Status:** Design approved
**Depends on:** Existing Skills + Commands tabs (branch `main`)

## Overview

Add three new explorer tabs to the HO OpenCode Explorer VS Code extension sidebar: **Agents**, **MCP Servers**, and **Prompts & Instructions**. Each browses a new type of OpenCode content with the same read + basic-actions interaction model already used by the Skills and Commands tabs. The feature set is implemented on a generic tree provider that consolidates the duplicated provider logic from Skills/Commands.

## Goals / Non-Goals

**Goals**
- Browse agents, MCP servers, and prompts/instructions defined globally (user config) or locally (workspace).
- Show structured details per item in the existing detail panel.
- Provide basic actions: open source file, open referenced prompt file, copy path/URL, preview content.
- Refactor duplicate tree-provider and frontmatter logic into shared modules.

**Non-Goals**
- Live start/stop of MCP servers or spawning the OpenCode daemon. MCP "status" reflects the `enabled` flag in config, not a running process.
- Editing agent definitions, MCP config, or prompt files from the UI.
- Exploring providers/models, hooks, plugins, or secrets (out of scope for this iteration).

## Architecture

### Views in the Sidebar Container

The `ho-opencode-explorer` view container gets 3 new tree views:

| View ID                | Name                 | Type  | Description                                        |
| ---------------------- | -------------------- | ----- | -------------------------------------------------- |
| `ho-opencode-skills`   | Skills               | tree  | Existing — unchanged (migrated to generic provider) |
| `ho-opencode-commands` | Commands             | tree  | Existing — unchanged (migrated to generic provider) |
| `ho-opencode-agents`   | Agents               | tree  | **New** — agents from config + `.md` files         |
| `ho-opencode-mcp`      | MCP Servers          | tree  | **New** — MCP servers from config + `.mcp.json`    |
| `ho-opencode-prompts`  | Prompts & Instructions | tree | **New** — prompt files + AGENTS.md/CLAUDE.md       |
| `ho-opencode-detail`   | Details              | webview | Existing — refactored into per-type renderers     |

### New / Modified Modules

```
src/
├── scanner/
│   ├── SkillsScanner.ts          # existing — extract shared frontmatter helper
│   ├── CommandsScanner.ts        # existing — extract shared frontmatter helper
│   ├── AgentsScanner.ts          # NEW
│   ├── McpScanner.ts             # NEW
│   ├── PromptsScanner.ts         # NEW
│   └── frontmatter.ts            # NEW — shared extractFrontmatter/extractBody
├── tree/
│   ├── ContentTreeDataProvider.ts # NEW — generic provider (also used by Skills/Commands)
│   ├── SkillTreeDataProvider.ts   # REMOVED — replaced by generic provider
│   ├── CommandsTreeDataProvider.ts # REMOVED — replaced by generic provider
├── panel/
│   ├── DetailPanel.ts             # MODIFIED — delegates to renderers
│   └── renderers/
│       ├── skill.ts               # NEW — extracted from DetailPanel
│       ├── command.ts             # NEW — extracted from DetailPanel
│       ├── agent.ts               # NEW
│       ├── mcp.ts                 # NEW
│       └── prompt.ts              # NEW
├── types.ts                       # MODIFIED — adds Agent, McpServer, PromptItem
└── extension.ts                   # MODIFIED — registers 3 views, generic routing, watchers
```

Nothing is removed functionally. Skills and Commands keep identical behavior; their providers are replaced by the generic provider and the existing tests guard the migration.

## Data Model (`src/types.ts` additions)

```typescript
type AgentSource = 'config' | 'global' | 'local';

interface Agent {
  name: string;
  description: string;
  mode: string; // 'primary' | 'subagent' | '' (empty when unspecified)
  model?: string;
  temperature?: number;
  promptFile?: string; // resolved path of referenced prompt file, if any
  tools?: string[];
  source: AgentSource;
  path: string; // opencode.json or agent .md path
  jsonPath?: string; // e.g. 'agent.code-architect' (config agents only)
  error?: string;
}

type McpSource = 'global' | 'project';

interface McpServer {
  name: string;
  type: string; // 'remote' | 'stdio' | 'http' | 'sse' | 'unknown'
  url?: string;
  command?: string;
  args?: string[];
  enabled: boolean;
  source: McpSource;
  path: string; // opencode.json or .mcp.json
  jsonPath?: string; // e.g. 'mcp.ai-memory' (opencode.json) or 'servers.ai-memory' (.mcp.json)
  error?: string;
}

type PromptKind = 'prompt' | 'instruction';
type PromptSource = 'global' | 'local';

interface PromptItem {
  name: string;
  kind: PromptKind;
  source: PromptSource;
  path: string;
  preview: string; // first N lines, for the detail panel
  error?: string;
}
```

## Feature 1 — Agents Explorer

### Scanner (`AgentsScanner`)

Sources, in order:
1. **Config agents**: `opencode.json` `agent` key. Each entry `{name}` → `{description?, mode?, model?, temperature?, prompt?, permission?, tools?}`. `prompt` may be a string or `{file: "..."}`; when a `file` reference exists, resolve it relative to the config directory and store the resolved path in `promptFile`. `path` = opencode.json, `jsonPath` = `agent.<name>`, source = `config`.
2. **Global markdown agents**: `~/.config/opencode/agent/*.md` (and `agents/` if present). Parse frontmatter `{name?, description?, mode?, model?, tools?}`; fall back to filename for `name`. Source = `global`.
3. **Local markdown agents**: `<workspace>/.opencode/agent/*.md`. Same parsing. Source = `local`.

Malformed YAML → item with `error` and warning icon (existing pattern).

### Tree

Categories: **From Config (N)** / **Global Agents (N)** / **Local Agents (N)** (omit empty). Node `contextValue` = `agent`; icon `$(account)`.

### Detail renderer (`renderers/agent.ts`)

Header: name + mode badge (`primary`/`subagent`). Sections: description, model + temperature (when set), tools (chips), referenced prompt file. Buttons: **Open Source File**, **Open Prompt** (only when `promptFile` set), **Copy Path**.

### Commands contributed

`_ho-opencode-explorer.openAgent#sideBar` (open source file) — `view/item/context` when `view == ho-opencode-agents && viewItem == agent`.

## Feature 2 — MCP Servers Explorer

### Scanner (`McpScanner`)

Sources:
1. **Global**: `opencode.json` `mcp` key. Each `{name}` → `{type?, url?, command?, args?, enabled?}`. `enabled` defaults `true`. `jsonPath` = `mcp.<name>`, `path` = opencode.json, source = `global`.
2. **Project**: `<workspace>/.mcp.json` `servers` (or `mcp`) key. Same shape; `enabled` default `true`. Source = `project`.

Unknown/unsupported type string → `type = 'unknown'` (still listed). Malformed JSON → item with `error`.

### Tree

Categories: **Global (N)** / **Project (N)**. Node description shows status badge text (`enabled`/`disabled`); node `contextValue` = `mcp`; icon `$(plug)`.

### Detail renderer (`renderers/mcp.ts`)

Header: name + enabled/disabled badge. Sections: type badge, transport (`url` for remote/http/sse, `command + args` for stdio), config path. Buttons: **Open Config File**, **Copy Path**, **Copy URL** (only when `url` set).

### Status limitation

Status is derived from the `enabled` flag in config. Live process status (running/stopped) is explicitly out of scope.

## Feature 3 — Prompts & Instructions Explorer

### Scanner (`PromptsScanner`)

Sources:
1. **Global prompts**: `~/.config/opencode/prompts/*.{txt,md}` → kind `prompt`, source `global`.
2. **Local prompts**: `<workspace>/.opencode/prompt/*.{txt,md}` → kind `prompt`, source `local`.
3. **Instructions**: `~/.config/opencode/AGENTS.md`, `~/.config/opencode/CLAUDE.md`, `<workspace>/AGENTS.md`, `<workspace>/CLAUDE.md` → kind `instruction`, source `global`/`local`.

`preview` = first 40 lines (or full file if shorter), trimmed. Unreadable file → item with `error`.

### Tree

Categories: **Prompts — Global (N)** / **Prompts — Local (N)** / **Instructions — Global (N)** / **Instructions — Local (N)** (omit empty). Node `contextValue` = `prompt`; icons `$(file-text)` (prompt) and `$(book)` (instruction).

### Detail renderer (`renderers/prompt.ts`)

Header: name + kind badge + source badge. `<pre>` with the escaped `preview`. Buttons: **Open File**, **Copy Path**.

## Generic Tree Provider

`ContentTreeDataProvider<T>` replaces `SkillTreeDataProvider` and `CommandsTreeDataProvider`. It is parameterized by a small per-type config:

```typescript
interface ProviderConfig<T> {
  getItem(element: ItemNode<T>): vscode.TreeItem; // label, icon, contextValue, checkboxState
  groups(): CategoryNode<T>[];                     // categories built from scanner output
  children(category: CategoryNode<T>): ItemNode<T>[];
}
```

Behavior is identical to current providers:
- Categories expanded, `(count)` suffix, `contextValue` per type.
- Skill items keep checkbox toggle (checkboxState driven by `enabled`).
- Command items keep icon by source (`$(file)` / `$(json)`) and warning icon on `error`.

## Detail Panel Refactor

`DetailPanel` keeps: webview setup, CSP + nonce + escape helpers, message routing (`openFile` / `copyPath`, validated). HTML generation moves to per-type renderer functions:

```typescript
// renderers/*.ts
export function renderAgent(webview: vscode.Webview, nonce: string, item: Agent): string;
export function renderMcp(webview: vscode.Webview, nonce: string, item: McpServer): string;
export function renderPrompt(webview: vscode.Webview, nonce: string, item: PromptItem): string;
export function renderSkill(...): string;
export function renderCommand(...): string;
```

`DetailPanel.show*(...)` methods become `show(node)` dispatching on item type. CSP, nonce, and escape helpers are exported from a shared module (`panel/html.ts`) so renderers stay consistent.

## Extension Wiring (`extension.ts`)

- Register 3 new `createTreeView` calls with the generic provider.
- Replace per-type selection handlers with one `handleSelection(node)` that switches on the item type and calls `detailPanel.show(node)` or `clear()`.
- Register commands `_ho-opencode-explorer.openAgent#sideBar` (and prompt/MCP open-file commands as needed).
- Extend `setupFileWatchers`:
  - agents: `**/agent/*.md` under config and workspace
  - mcp: `opencode.json`, `.mcp.json` (reuse existing config watcher + add `.mcp.json`)
  - prompts: `prompts/**` under config, `prompt/**` under workspace, `AGENTS.md` / `CLAUDE.md` (config + workspace)
- Debounce: reuse the per-type debounce timers pattern (skills/commands already split).

## Error Handling & Edge Cases

- Missing dirs / missing config keys → empty groups (existing pattern).
- Malformed YAML/JSON → item with `error`, warning icon, still listed.
- Agent without description → name only in detail.
- `prompt: {file: ...}` pointing outside config dir → resolve best-effort; if file missing, omit "Open Prompt" button.
- `.mcp.json` with neither `servers` nor `mcp` key → empty.
- Workspace without folders → local groups omitted (existing pattern).

## Testing

- Unit tests per new scanner with fixtures:
  - `src/test/fixtures/agents/` (config-style agent JSON, global `.md` with/without frontmatter, invalid YAML)
  - `src/test/fixtures/mcp/` (opencode.json with `mcp`, `.mcp.json` project fixture, malformed JSON)
  - `src/test/fixtures/prompts/` (`.txt` prompt, AGENTS.md instruction, unreadable file)
- Provider tests for `ContentTreeDataProvider` (categories, items, checkboxState for skills).
- Existing `scanner.test.ts`, `commandsScanner.test.ts`, `treeProvider.test.ts`, `commandsTreeProvider.test.ts` updated for the generic provider migration — behavior assertions stay identical.

## Out of Scope (future)

- Live MCP status / start-stop control.
- Editing agent/MCP/prompt definitions in the UI.
- Providers/models, hooks, plugins, secrets explorers.
- Search/filter, favorites, and statistics across content types.

## Files Summary

| File | Change |
| --- | --- |
| `src/types.ts` | add `Agent`, `McpServer`, `PromptItem` + source/kind types |
| `src/scanner/frontmatter.ts` | new shared helper |
| `src/scanner/AgentsScanner.ts` | new |
| `src/scanner/McpScanner.ts` | new |
| `src/scanner/PromptsScanner.ts` | new |
| `src/tree/ContentTreeDataProvider.ts` | new generic provider |
| `src/tree/SkillTreeDataProvider.ts` | removed — replaced by generic provider |
| `src/tree/CommandsTreeDataProvider.ts` | removed — replaced by generic provider |
| `src/panel/DetailPanel.ts` | refactored to delegate to renderers |
| `src/panel/html.ts` | shared CSP/nonce/escape |
| `src/panel/renderers/*.ts` | skill, command, agent, mcp, prompt |
| `src/extension.ts` | 3 views, routing, watchers, commands |
| `package.json` | 3 views, 1-3 commands |
| test files + fixtures | new + updated |
