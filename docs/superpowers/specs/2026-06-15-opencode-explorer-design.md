# HO OpenCode Explorer — Design Specification

**Date:** 2026-06-15
**Status:** Design approved
**Author:** Hugo

---

## 1. Overview

HO OpenCode Explorer is a VS Code extension that adds a sidebar panel (activity bar, left side) to browse and manage OpenCode skills. Skills are organized into **Global Skills** and **Local Skills**, with enable/disable toggles.

### Goals

- Browse global and local OpenCode skills in a native VS Code TreeView
- Toggle skills on/off by editing SKILL.md YAML frontmatter
- Show skill details in a bottom detail panel (WebviewView)
- Display version badge and update button in the sidebar header
- Minimal, lightweight — zero frameworks, zero bloat, no memory leaks

---

## 2. Product Name & Identity

**Product:** HO OpenCode Explorer
**Extension ID:** `ho-opencode-explorer`
**Publisher:** Hugo (ho)
**Icon:** Activity bar icon using VS Code codicon or custom SVG

All Hugo products use the `HO` prefix.

---

## 3. Architecture

### 3.1 Stack

| Area | Choice | Rationale |
|------|--------|-----------|
| Language | TypeScript 5.x (strict mode) | Community standard |
| Runtime | Node 20 LTS | VS Code internal Node version |
| Build | esbuild | Microsoft recommended, fast |
| Tests | @vscode/test-cli + @vscode/test-electron + mocha | Official VS Code test stack |
| Lint | eslint flat config + @typescript-eslint | Modern ESLint |
| Format | prettier | Consistent style |
| Webview CSS | VS Code CSS variables (--vscode-*) | Toolkit deprecated Jan/2025 |
| Commits | commitlint + husky + conventional commits | Open source standard |
| Versioning | standard-version | Auto CHANGELOG.md |
| CI | GitHub Actions (ubuntu + macos + windows) | Multi-platform |
| Publish | vsce + semantic-release | Auto Marketplace publish |

### 3.2 Runtime Dependencies

Only 2 lightweight packages — zero transitive bloat:

| Dependency | Size | Purpose |
|------------|------|---------|
| `yaml` | ~50KB | Parse SKILL.md frontmatter |
| `semver` | ~25KB | Version comparison for updates |

Everything else uses Node.js built-ins (`fs`, `path`, `os`) and VS Code API.

### 3.3 Modules

```
src/
├── extension.ts                  # activate/deactivate entry point
├── scanner/
│   └── SkillsScanner.ts          # Scans paths, parses SKILL.md frontmatter
├── tree/
│   └── SkillTreeDataProvider.ts  # TreeDataProvider with inline checkboxes
├── panel/
│   └── SkillDetailPanel.ts       # WebviewViewProvider for detail panel
├── toggle/
│   └── SkillToggleManager.ts     # Read/write enabled in YAML frontmatter
├── update/
│   └── UpdateService.ts          # GitHub Releases API version check
└── version/
    └── VersionHeader.ts          # Badge display in sidebar title
```

### 3.4 Directory Structure

```
ho-opencode-explorer/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                # Lint + Test on ubuntu/macos/windows
│   │   └── release.yml           # Publish to Marketplace on tag
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── PULL_REQUEST_TEMPLATE.md
├── src/
│   ├── extension.ts
│   ├── scanner/
│   │   └── SkillsScanner.ts
│   ├── tree/
│   │   └── SkillTreeDataProvider.ts
│   ├── panel/
│   │   └── SkillDetailPanel.ts
│   ├── toggle/
│   │   └── SkillToggleManager.ts
│   ├── update/
│   │   └── UpdateService.ts
│   └── version/
│       └── VersionHeader.ts
├── src/test/
│   ├── suite/
│   │   ├── scanner.test.ts
│   │   ├── treeProvider.test.ts
│   │   ├── toggleManager.test.ts
│   │   └── updateService.test.ts
│   └── runTests.ts
├── docs/
│   └── superpowers/specs/2026-06-15-opencode-explorer-design.md
├── .vscode-test.js               # Test CLI config
├── esbuild.config.js             # Build config
├── CHANGELOG.md                  # Auto-generated
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── LICENSE                       # MIT
├── README.md
├── package.json
├── tsconfig.json
├── eslint.config.mjs             # Flat config
├── .prettierrc
├── .vscodeignore
└── .gitignore
```

---

## 4. Sidebar Layout

```
┌─────────────────────────────────┐
│ HO OpenCode Explorer    v1.2.3  │  ← Header: name + version badge + ↻ Update button
│                         ↻ Update│
├─────────────────────────────────┤
│ ▾ GLOBAL SKILLS (12)            │  ← Collapsible section
│   ☑ brainstorming               │  ← Enabled skill
│   ☐ coding-standards            │  ← Disabled skill (reduced opacity)
│   ☑ frontend-design             │
│   ☑ graphify                    │
│  ...                            │
│─────────────────────────────────│
│ ▾ LOCAL SKILLS (3)              │  ← Collapsible section
│   ☑ my-custom-skill             │
│   ☑ project-tests               │
│   ☐ wip-feature                 │
├─────────────────────────────────┤
│ SKILL DETAILS                   │  ← Bottom panel (WebviewView)
│ 📋 brainstorming                │
│ ~/.config/opencode/skills/...   │
│ "Explores user intent..."       │
│ [📂 Open SKILL.md] [📋 Copy]   │
└─────────────────────────────────┘
```

---

## 5. Behavior & Data Flow

### 5.1 Initialization

1. VS Code activates extension on `onView:ho-opencode-skills`
2. `SkillsScanner` scans 4 directories in parallel:
   - `~/.config/opencode/skills/` → Global
   - `~/.opencode/skills/` → Global
   - `~/.cache/opencode/packages/` → Global (recursive SKILL.md search)
   - `.opencode/skills/` → Local (relative to workspace)
3. Each `SKILL.md` is parsed for YAML frontmatter: `name`, `description`, `enabled`
4. `SkillTreeDataProvider` categorizes into Global/Local tree nodes
5. TreeView renders with checkboxes (☑ enabled, ☐ disabled with opacity)
6. `VersionHeader` reads `package.json` version → displays as badge

### 5.2 Toggle Enable/Disable

1. User clicks skill checkbox
2. `SkillToggleManager` reads the SKILL.md, toggles `enabled` field in YAML frontmatter
3. If no `enabled` field exists, adds `enabled: true/false`
4. TreeDataProvider fires refresh on affected node
5. UI updates checkbox state + opacity

### 5.3 Detail Panel

1. User clicks on a skill in the TreeView (`onDidChangeSelection`)
2. `SkillDetailPanel` receives skill data, renders HTML webview with:
   - Skill name + icon
   - Full filesystem path
   - Description from SKILL.md frontmatter
   - Action buttons: Open SKILL.md, Copy Path
3. Webview uses CSS variables (`--vscode-*`) for theme integration

### 5.4 Update Check

1. User clicks ↻ Update button in sidebar header
2. `UpdateService` queries GitHub Releases API (`ho-opencode-explorer` repo)
3. Compares local version (from `package.json`) with latest release (semver)
4. If update available → info notification: "vX.Y.Z available. Install?"
5. If up to date → info notification: "Already up to date (vX.Y.Z)"
6. On confirm → opens Marketplace or .vsix download URL

### 5.5 File Watchers

- `FileSystemWatcher` on all skill directories
- On SKILL.md create/delete/rename → TreeView auto-refreshes
- 500ms debounce to prevent cascade refreshes

---

## 6. Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| No workspace open | Show only Global Skills; hide Local Skills section |
| SKILL.md without frontmatter | Assume `enabled: true` default |
| SKILL.md with invalid YAML | Show skill with ⚠️ warning icon, skip toggle |
| Empty skill directory | Show "No skills found" message |
| No internet (update check) | Show "Could not check for updates" |
| Skill directory deleted while running | Watcher removes from tree automatically |

---

## 7. Performance & Memory

### 7.1 Principles

- All VS Code API objects registered via `context.subscriptions` (auto-disposed)
- `deactivate()` cleans ALL resources: watchers, cache, timers, listeners
- Scanner runs once on activate, then reacts to FileSystemWatcher events — never polls
- Cache only tree structure (name + enabled), never full SKILL.md content
- Detail panel webview loads on-demand only when a skill is selected
- Debounce on watchers: 500ms

### 7.2 Targets

| Metric | Target |
|--------|--------|
| Idle memory | < 10MB |
| Initial scan (50 skills) | < 200ms |
| Toggle latency | < 50ms |
| Max active watchers | 4 (one per directory) |
| .vsix size | < 500KB |

### 7.3 What We Don't Include

- No React, Vue, Svelte, or any UI framework
- No webview bundler (vanilla HTML + CSS variables)
- No state management library (Redux, Zustand)
- No database or ORM
- No webview-ui-toolkit (deprecated)

---

## 8. Skill Source Paths

### Global

| Path | Type |
|------|------|
| `~/.config/opencode/skills/` | User-installed skills |
| `~/.opencode/skills/` | Legacy / alternative location |
| `~/.cache/opencode/packages/` | Package-installed skills (recursive scan for SKILL.md) |

### Local

| Path | Type |
|------|------|
| `.opencode/skills/` | Workspace-local skills (relative to workspace root) |

---

## 9. package.json Configuration

### Activation Events

```json
{
  "activationEvents": [
    "onView:ho-opencode-skills"
  ]
}
```

### Contribution Points

```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "ho-opencode-explorer",
          "title": "HO OpenCode Explorer",
          "icon": "$(hubot)"
        }
      ]
    },
    "views": {
      "ho-opencode-explorer": [
        {
          "id": "ho-opencode-skills",
          "name": "Skills"
        }
      ]
    }
  }
}
```

---

## 10. Testing Strategy

### Unit Tests (mocha, no VS Code needed — pure logic)
- `scanner.test.ts`: Path resolution, YAML parsing, skill detection
- `toggleManager.test.ts`: Read/write frontmatter, edge cases
- `updateService.test.ts`: Version comparison, API response handling

### Integration Tests (mocha + @vscode/test-electron)
- `treeProvider.test.ts`: TreeView renders correct structure, checkbox state
- Full extension activation in VS Code test host

Single test framework (mocha) for both unit and integration — reduces cognitive load and dependency count. Unit tests run without VS Code host for speed.

### CI Matrix
- OS: ubuntu-latest, macos-latest, windows-latest
- Node: 20.x

---

## 11. Release & Changelog

- Conventional commits enforced via commitlint + husky
- `standard-version` generates CHANGELOG.md on release
- GitHub Actions publishes to VS Code Marketplace on git tag
- `.vscodeignore` excludes test files, docs, configs from .vsix

---

## 12. Open Source Files

| File | Content |
|------|---------|
| `README.md` | Product description, install, usage, features, badges |
| `CONTRIBUTING.md` | Dev setup, commit conventions, PR process |
| `CODE_OF_CONDUCT.md` | Community guidelines |
| `CHANGELOG.md` | Auto-generated release history |
| `LICENSE` | MIT |
| `.github/ISSUE_TEMPLATE/` | Bug report + feature request templates |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR checklist |
