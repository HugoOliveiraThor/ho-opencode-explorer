# HO OpenCode Explorer — Content Creation & Editing

**Date:** 2026-08-05
**Status:** Design approved
**Depends on:** Existing explorer (5 content tabs, generic provider, detail panel)

## Overview

Turn the HO OpenCode Explorer from a read-only browser into a content management tool. Three features enable creating new OpenCode content, editing skill metadata inline, and moving items between global and local sources — all from the sidebar without leaving VS Code.

## Goals / Non-Goals

**Goals**
- Create a new skill or command from a wizard (native VS Code dialogs).
- Edit a skill's `name`, `description`, and `enabled` inline in the detail panel and persist to the `SKILL.md` frontmatter.
- Move a skill or command between global and local sources (destructive, confirmed).

**Non-Goals**
- Editing commands, agents, MCP, or prompts (skills only for inline editing in this iteration).
- Editing raw YAML or free-form body content — the editor manages known frontmatter fields only.
- Drag-and-drop, clipboard-based move, or bulk operations.
- Git-style undo history (a move is confirmed before execution; no automatic backups).

## Architecture

### New Modules

```
src/
├── create/
│   └── ContentCreator.ts        # NEW — scaffold skills and commands
├── edit/
│   └── SkillEditor.ts           # NEW — persist skill frontmatter edits
├── move/
│   └── ContentMover.ts          # NEW — move skills/commands global ↔ local
├── util/
│   └── safePaths.ts             # NEW — path validation shared by create/edit/move
├── panel/
│   ├── renderers/skill.ts       # MODIFIED — add Edit button + edit form + Save wiring
│   └── DetailPanel.ts           # MODIFIED — handle editSkill message
└── extension.ts                 # MODIFIED — register 4 commands, wire refresh after ops
```

All three modules follow the existing scanner/toggle pattern: plain TypeScript classes with injectable path overrides for testing.

### Commands Contributed

| Command ID | Title | Icon | Location |
| --- | --- | --- | --- |
| `_ho-opencode-explorer.newSkill#sideBar` | New Skill | `$(new-file)` | `view/title` of `ho-opencode-skills` |
| `_ho-opencode-explorer.newCommand#sideBar` | New Command | `$(new-file)` | `view/title` of `ho-opencode-commands` |
| `_ho-opencode-explorer.moveSkill#sideBar` | Move Skill | `$(arrow-swap)` | `view/item/context` of skills (`viewItem == skill`) |
| `_ho-opencode-explorer.moveCommand#sideBar` | Move Command | `$(arrow-swap)` | `view/item/context` of commands (`viewItem == command`) |

All hidden from the Command Palette per the sidebar convention.

## Shared Path Safety (`src/util/safePaths.ts`)

Every file operation validates that its target stays inside an allowed root:

```typescript
export function resolveWithin(base: string, relative: string): string | null;
export function assertSafeName(name: string): string; // throws on '', '..', '/', '\\', control chars
```

- `resolveWithin` uses `path.resolve` and verifies the result starts with `path.resolve(base) + path.sep`; returns `null` on escape attempts.
- `assertSafeName` rejects empty names, `.` / `..`, and any path separators; the caller applies kebab-case normalization.

## Feature 1 — Content Creation Wizard (`src/create/ContentCreator.ts`)

### Behavior

`createSkill(workspaceRoot?: string): Promise<void>`:
1. `vscode.window.showQuickPick(['Global', 'Local'])` — Local is disabled/errored when no workspace folder is open.
2. `vscode.window.showInputBox({ prompt: 'Skill name', validateInput })` — name must pass `assertSafeName` and not already exist at the destination.
3. Resolve destination: Global → `~/.config/opencode/skills/<name>/`, Local → `<workspace>/.opencode/skills/<name>/`.
4. `mkdir` the directory and write `SKILL.md`:

```markdown
---
name: <name>
description: ""
enabled: true
---

# <name>

Describe what this skill does.
```

5. Call the skills refresh and reveal the new item in the tree.

`createCommand(workspaceRoot?: string): Promise<void>` — same flow, destination `~/.config/opencode/commands/<name>.md` or `<workspace>/.opencode/commands/<name>.md`, writing:

```markdown
---
description: ""
---

Describe what this command does.
```

### Error handling
- Destination exists → `showErrorMessage('A skill named "x" already exists')`.
- Invalid name → inline `validateInput` error on the input box.
- Write failure → error message with the underlying cause; no partial directory left behind (clean up on failure).

## Feature 2 — Inline Skill Editor (`src/edit/SkillEditor.ts` + DetailPanel)

### Editor module

`editSkill(filePath: string, changes: { name: string; description: string; enabled: boolean }): void`:
1. Read `SKILL.md`.
2. Extract frontmatter with the existing `extractFrontmatter` helper.
3. If present: `YAML.parse`, merge `name`, `description`, `enabled` into the parsed object, `YAML.stringify` the merged object back as the frontmatter block.
4. If absent: create a new frontmatter block from `changes`.
5. Reassemble `---\n<frontmatter>\n---\n<body>` (body preserved verbatim) and write atomically (temp file + rename).
6. Throw on unparseable YAML; the caller surfaces the message.

### Detail panel

`renderers/skill.ts` gains:
- An **Edit** button (`✏️ Edit`) in the actions row when the skill has no `yamlError`.
- An edit mode: a form with inputs for `name`, `description`, and an `enabled` checkbox, pre-filled from the skill, plus **Save** and **Cancel** buttons. Rendered inside the existing CSP/nonce scaffold. All pre-filled values are injected into `value="..."` attributes through `escapeAttr` (and text nodes through `escapeHtml`) so quotes/HTML in existing descriptions cannot break the form or inject markup.
- Save posts `{ command: 'editSkill', path, name, description, enabled }`.

`DetailPanel.ts` extends `onDidReceiveMessage` handling (validated):
```typescript
// editSkill requires: path: string, name: string, description: string, enabled: boolean
```
On valid `editSkill`: call `SkillEditor.editSkill`, show `showInformationMessage('Skill updated')`, call the skills refresh, and re-render the panel with the updated skill. On error: `showErrorMessage`.

## Feature 3 — Move Between Sources (`src/move/ContentMover.ts`)

### Behavior

`moveSkill(filePath: string, source: 'global' | 'local', workspaceRoot?: string): Promise<void>`:
1. Determine target: Global → `<workspace>/.opencode/skills/<dirname>`; Local → `~/.config/opencode/skills/<dirname>`. Local operations error when no workspace folder is open.
2. `showWarningMessage('Move skill "x" to <Local|Global>? The original will be removed.', 'Move', 'Cancel')` — proceed only on **Move**.
3. Validate target does not exist; then move the directory with `fs.renameSync`, falling back to `fs.cpSync` + `fs.rmSync` if rename crosses devices (EXDEV).
4. Refresh the skills view.

`moveCommand(filePath, source, workspaceRoot)` — identical flow for the `.md` file (`~/.config/opencode/commands/<name>.md` ↔ `<workspace>/.opencode/commands/<name>.md`).

### Error handling
- No workspace open for local target → clear error.
- Target exists → error, nothing moved.
- Path escape / invalid source → `safePaths` rejects before any fs call.

## Extension Wiring

`extension.ts`:
- Import `ContentCreator`, `SkillEditor`, `ContentMover`.
- Register the four commands with `_ho-opencode-explorer.<name>#sideBar` IDs.
- Move handlers call the module, then the corresponding `refresh*()` function.
- `DetailPanel` is constructed with an `onSkillEdited` callback: `new DetailPanel({ onSkillEdited: (updated: Skill) => { refreshSkills(); detailPanel.show(updated); } })`. The panel calls it after a successful `editSkill` save.

## Error Handling & Edge Cases

- No workspace folder: local create/move options error with a clear message; global-only flows unaffected.
- Name collisions at destination: rejected before writing.
- Read-only or missing source file on move: error surfaced, nothing removed.
- Corrupt frontmatter on edit: error surfaced, original file untouched.
- Name sanitization: kebab-case normalization applied; reserved separators rejected.

## Testing

- `src/test/suite/contentCreator.test.ts` — temp-dir based: scaffolds correct frontmatter for skill and command, rejects invalid names, rejects existing destination, cleans up on failure.
- `src/test/suite/skillEditor.test.ts` — temp-file based: updates all three fields, preserves body, creates frontmatter when absent, throws on invalid YAML, writes atomically.
- `src/test/suite/contentMover.test.ts` — temp-dir based: moves skill dir, moves command file, rejects when target exists, rejects path escapes, handles missing source.
- `src/test/suite/safePaths.test.ts` — traversal rejection, valid relative resolution, name validation.
- All modules accept constructor/path overrides (same pattern as scanners) for fixture injection.

## Out of Scope (future)

- Editing commands, agents, MCP, or prompts inline.
- Free-form YAML/body editing.
- Copy (non-destructive) operations and undo history.
- Bulk create/move and drag-and-drop.

## Files Summary

| File | Change |
| --- | --- |
| `src/util/safePaths.ts` | new |
| `src/create/ContentCreator.ts` | new |
| `src/edit/SkillEditor.ts` | new |
| `src/move/ContentMover.ts` | new |
| `src/panel/renderers/skill.ts` | add Edit button + edit form |
| `src/panel/DetailPanel.ts` | handle `editSkill` message |
| `src/extension.ts` | register 4 commands + wiring |
| `package.json` | 4 commands + menus |
| test files | contentCreator, skillEditor, contentMover, safePaths |
