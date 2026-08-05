# Content Explorers Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new explorer tabs (Agents, MCP Servers, Prompts & Instructions) to the HO OpenCode Explorer extension, backed by a generic tree provider that replaces the duplicated Skill/Command providers.

**Architecture:** Generic `ContentTreeDataProvider<T>` configured by per-type factory functions; new scanners (`AgentsScanner`, `McpScanner`, `PromptsScanner`) follow the existing scanner pattern; `DetailPanel` is refactored so HTML generation moves to per-type renderer modules sharing a common `html.ts` helper (CSP/nonce/escape). All item types carry a `itemType` discriminator so `DetailPanel.show()` dispatches cleanly.

**Tech Stack:** TypeScript (Node16 modules), VS Code API, esbuild, `@vscode/test-cli` + Mocha, `yaml`.

## Global Constraints

- VS Code engine floor: `^1.85.0` (package.json `engines.vscode`).
- TypeScript strict mode: `strict: true`, `noUncheckedIndexedAccess: true` (tsconfig.json). Every array index access must handle `undefined`.
- Command IDs follow the sidebar convention: `_ho-opencode-explorer.<name>#sideBar`.
- Every item type carries `itemType` with a literal value: `'skill' | 'command' | 'agent' | 'mcp' | 'prompt'`.
- All WebView HTML keeps the strict CSP (`default-src 'none'; script-src 'nonce-…'`) and all interpolated user data is escaped via `escapeHtml`/`escapeAttr`.
- Scanners resolve user paths from `process.env.HOME || process.env.USERPROFILE` and accept constructor overrides for tests.
- Tests live in `src/test/suite/*.test.ts`; fixtures in `src/test/fixtures/<name>/`. Test files reference fixtures via `path.resolve(__dirname, '..', '..', '..', 'src', 'test', 'fixtures', '<name>')`.
- Commit messages follow Conventional Commits; the pre-commit hook runs lint and must pass.

---

### Task 1: Types + shared frontmatter helper + scanner migration

**Files:**
- Create: `src/scanner/frontmatter.ts`
- Modify: `src/types.ts` (add `itemType` to Skill/Command; add `Agent`, `McpServer`, `PromptItem`, `DetailItem`)
- Modify: `src/scanner/SkillsScanner.ts` (use `extractFrontmatter`, set `itemType`)
- Modify: `src/scanner/CommandsScanner.ts` (use `extractFrontmatter`/`extractBody`, set `itemType`)
- Modify: `src/test/suite/treeProvider.test.ts` (add `itemType: 'skill'` to Skill literals)
- Modify: `src/test/suite/commandsTreeProvider.test.ts` (add `itemType: 'command'` to Command literals)
- Test: `src/test/suite/frontmatter.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `src/scanner/frontmatter.ts` exports `extractFrontmatter(content: string): string | null` and `extractBody(content: string): string`. `src/types.ts` exports `ExplorerItemType`, `Agent`, `McpServer`, `PromptItem`, `DetailItem`, `AgentSource`, `McpSource`, `PromptKind`, `PromptSource`. `Skill`/`Command` gain `itemType` literals.

- [ ] **Step 1: Add the new types to `src/types.ts`**

Append after the existing `CommandGroup` interface:

```typescript
export type ExplorerItemType = 'skill' | 'command' | 'agent' | 'mcp' | 'prompt';

export type AgentSource = 'config' | 'global' | 'local';

export interface Agent {
  itemType: 'agent';
  name: string;
  description: string;
  mode: string; // 'primary' | 'subagent' | '' when unspecified
  model?: string;
  temperature?: number;
  promptFile?: string;
  tools?: string[];
  source: AgentSource;
  path: string;
  jsonPath?: string;
  error?: string;
}

export type McpSource = 'global' | 'project';

export interface McpServer {
  itemType: 'mcp';
  name: string;
  type: string; // 'remote' | 'stdio' | 'http' | 'sse' | 'unknown'
  url?: string;
  command?: string;
  args?: string[];
  enabled: boolean;
  source: McpSource;
  path: string;
  jsonPath?: string;
  error?: string;
}

export type PromptKind = 'prompt' | 'instruction';
export type PromptSource = 'global' | 'local';

export interface PromptItem {
  itemType: 'prompt';
  name: string;
  kind: PromptKind;
  source: PromptSource;
  path: string;
  preview: string;
  error?: string;
}

export type DetailItem = Skill | Command | Agent | McpServer | PromptItem;
```

Then add `itemType` to the existing `Skill` and `Command` interfaces:

```typescript
export interface Skill {
  itemType: 'skill';
  name: string;
  // ... existing fields unchanged
}

export interface Command {
  itemType: 'command';
  name: string;
  // ... existing fields unchanged
}
```

- [ ] **Step 2: Create `src/scanner/frontmatter.ts`**

```typescript
export function extractFrontmatter(content: string): string | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1]! : null;
}

export function extractBody(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1]!.trim() : '';
}
```

- [ ] **Step 3: Migrate `SkillsScanner.ts` and `CommandsScanner.ts`**

In `SkillsScanner.ts`:
- Add `import { extractFrontmatter } from './frontmatter.js';`
- Delete the private `extractFrontmatter` method.
- Replace the two call sites `this.extractFrontmatter(content)` with `extractFrontmatter(content)`.
- In the returned Skill objects (both success and error paths), add `itemType: 'skill',`.

In `CommandsScanner.ts`:
- Add `import { extractFrontmatter, extractBody } from './frontmatter.js';`
- Delete private `extractFrontmatter` and `extractBody` methods.
- Replace `this.extractFrontmatter(content)` → `extractFrontmatter(content)` and `this.extractBody(content)` → `extractBody(content)`.
- In every returned Command object, add `itemType: 'command',`.

- [ ] **Step 4: Update existing test literals**

In `src/test/suite/treeProvider.test.ts`, add `itemType: 'skill'` to both `globalSkill` and `localSkill` literals.

In `src/test/suite/commandsTreeProvider.test.ts`, add `itemType: 'command'` to each Command literal in `mockGroups` and in the inline `broken` command.

- [ ] **Step 5: Write `src/test/suite/frontmatter.test.ts`**

```typescript
import * as assert from 'assert';
import { extractFrontmatter, extractBody } from '../../scanner/frontmatter.js';

suite('frontmatter helper', () => {
  test('extracts YAML frontmatter', () => {
    const fm = extractFrontmatter('---\nname: foo\n---\nbody text');
    assert.strictEqual(fm, 'name: foo');
  });

  test('returns null when no frontmatter', () => {
    assert.strictEqual(extractFrontmatter('no frontmatter'), null);
  });

  test('extracts body after frontmatter', () => {
    const body = extractBody('---\nname: foo\n---\n\nbody line');
    assert.strictEqual(body, 'body line');
  });

  test('returns empty string when body empty', () => {
    assert.strictEqual(extractBody('---\nname: foo\n---'), '');
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx tsc -p tsconfig.test.json`
Expected: FAIL — `frontmatter.js` not found (test imports a module that does not exist yet). TypeScript errors for missing `itemType` on the migrated scanner returns will also surface here; both are expected.

- [ ] **Step 7: Implement the migration (Steps 1-4 already applied)**

Ensure all files from Steps 1-4 are complete and consistent, then re-run the compile.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx tsc -p tsconfig.test.json`
Expected: PASS (no type errors).

Run: `npx tsc --noEmit`
Expected: PASS (source-only typecheck).

Run: `npm run lint`
Expected: PASS (the existing single `no-console` warning in `runTests.ts` is allowed).

- [ ] **Step 9: Commit**

```bash
git add src/scanner/frontmatter.ts src/types.ts src/scanner/SkillsScanner.ts src/scanner/CommandsScanner.ts src/test/suite/frontmatter.test.ts src/test/suite/treeProvider.test.ts src/test/suite/commandsTreeProvider.test.ts
git commit -m "feat: add shared frontmatter helper and item types"
```

---

### Task 2: AgentsScanner + tests

**Files:**
- Create: `src/scanner/AgentsScanner.ts`
- Create: `src/test/fixtures/agents/config/opencode.json`
- Create: `src/test/fixtures/agents/global/architect.md`
- Create: `src/test/fixtures/agents/global/broken.md`
- Create: `src/test/suite/agentsScanner.test.ts`

**Interfaces:**
- Consumes: `extractFrontmatter` from `./frontmatter.js`; `Agent`, `AgentSource` from `../types.js`.
- Produces: `class AgentsScanner` with constructor `constructor(overrides: Partial<{ configPath: string; globalDir: string; localDir: string }> = {})` and method `scanAll(workspaceRoot?: string): Promise<{ config: Agent[]; global: Agent[]; local: Agent[] }>`. Public test hook `scanMarkdownAgents(dirPath: string, source: AgentSource): Agent[]`.

- [ ] **Step 1: Write the failing test**

Create fixtures:

`src/test/fixtures/agents/config/opencode.json`:
```json
{
  "agent": {
    "code-architect": {
      "description": "Architecture reviewer",
      "mode": "primary",
      "model": "opencode/deepseek-v4-pro",
      "temperature": 0.1,
      "prompt": { "file": "./prompts/code-architect.txt" }
    },
    "plan": {}
  }
}
```

`src/test/fixtures/agents/global/architect.md`:
```markdown
---
name: architect
description: A global agent
mode: subagent
model: opencode/deepseek-v4-flash
tools: ["read", "edit"]
---
Agent body.
```

`src/test/fixtures/agents/global/broken.md`:
```markdown
---
name: broken
description: [unclosed
---
Body.
```

`src/test/suite/agentsScanner.test.ts`:
```typescript
import * as assert from 'assert';
import * as path from 'path';
import { AgentsScanner } from '../../scanner/AgentsScanner.js';
import type { Agent } from '../../types.js';

suite('AgentsScanner', () => {
  const fixturesDir = path.resolve(__dirname, '..', '..', '..', 'src', 'test', 'fixtures', 'agents');
  const scanner = new AgentsScanner({
    configPath: path.join(fixturesDir, 'config', 'opencode.json'),
    globalDir: path.join(fixturesDir, 'global'),
  });

  test('scans config agents with metadata', async () => {
    const { config } = await scanner.scanAll(undefined);
    const architect = config.find((a: Agent) => a.name === 'code-architect');
    assert.ok(architect);
    assert.strictEqual(architect!.mode, 'primary');
    assert.strictEqual(architect!.model, 'opencode/deepseek-v4-pro');
    assert.strictEqual(architect!.source, 'config');
    assert.ok(architect!.jsonPath, 'agent.code-architect');
  });

  test('config agent with empty object still listed', async () => {
    const { config } = await scanner.scanAll(undefined);
    const plan = config.find((a: Agent) => a.name === 'plan');
    assert.ok(plan);
    assert.strictEqual(plan!.description, '');
  });

  test('resolves prompt file reference when present', async () => {
    const { config } = await scanner.scanAll(undefined);
    const architect = config.find((a: Agent) => a.name === 'code-architect');
    assert.ok(architect!.promptFile);
    assert.ok(path.isAbsolute(architect!.promptFile!));
  });

  test('omits promptFile when referenced file missing', async () => {
    const { config } = await scanner.scanAll(undefined);
    const plan = config.find((a: Agent) => a.name === 'plan');
    assert.strictEqual(plan!.promptFile, undefined);
  });

  test('scans global markdown agents', async () => {
    const { global } = await scanner.scanAll(undefined);
    const architect = global.find((a: Agent) => a.name === 'architect');
    assert.ok(architect);
    assert.strictEqual(architect!.mode, 'subagent');
    assert.deepStrictEqual(architect!.tools, ['read', 'edit']);
    assert.strictEqual(architect!.source, 'global');
  });

  test('marks invalid YAML with error', async () => {
    const { global } = await scanner.scanAll(undefined);
    const broken = global.find((a: Agent) => a.name === 'broken');
    assert.ok(broken);
    assert.ok(broken!.error);
  });

  test('returns empty local group without workspace', async () => {
    const { local } = await scanner.scanAll(undefined);
    assert.deepStrictEqual(local, []);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsc -p tsconfig.test.json`
Expected: FAIL — module `../../scanner/AgentsScanner.js` not found.

- [ ] **Step 3: Write `src/scanner/AgentsScanner.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { extractFrontmatter } from './frontmatter.js';
import type { Agent, AgentSource } from '../types.js';

interface AgentsScannerOverrides {
  configPath: string;
  globalDir: string;
  localDir: string;
}

interface AgentEntry {
  description?: unknown;
  mode?: unknown;
  model?: unknown;
  temperature?: unknown;
  prompt?: unknown;
  tools?: unknown;
}

export class AgentsScanner {
  private readonly configPath: string;
  private readonly globalDir: string;
  private readonly localDir: string;

  constructor(overrides: Partial<AgentsScannerOverrides> = {}) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    this.configPath = overrides.configPath ?? path.join(home, '.config', 'opencode', 'opencode.json');
    this.globalDir = overrides.globalDir ?? path.join(home, '.config', 'opencode', 'agent');
    this.localDir = overrides.localDir ?? '.opencode/agent';
  }

  async scanAll(
    workspaceRoot?: string,
  ): Promise<{ config: Agent[]; global: Agent[]; local: Agent[] }> {
    return {
      config: this.scanConfigAgents(),
      global: this.scanMarkdownAgents(this.globalDir, 'global'),
      local: workspaceRoot
        ? this.scanMarkdownAgents(path.join(workspaceRoot, this.localDir), 'local')
        : [],
    };
  }

  scanMarkdownAgents(dirPath: string, source: AgentSource): Agent[] {
    if (!fs.existsSync(dirPath)) return [];
    const agents: Agent[] = [];
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const filePath = path.join(dirPath, entry.name);
      const baseName = entry.name.replace(/\.md$/, '');
      const content = fs.readFileSync(filePath, 'utf-8');
      try {
        const frontmatter = extractFrontmatter(content);
        const parsed = frontmatter
          ? (YAML.parse(frontmatter) as { name?: string; description?: string; mode?: string; model?: string; tools?: unknown })
          : {};
        agents.push({
          itemType: 'agent',
          name: parsed.name || baseName,
          description: parsed.description || '',
          mode: parsed.mode || '',
          model: parsed.model,
          tools: this.asStringArray(parsed.tools),
          source,
          path: filePath,
        });
      } catch (err) {
        agents.push({
          itemType: 'agent',
          name: baseName,
          description: '',
          mode: '',
          source,
          path: filePath,
          error: err instanceof Error ? err.message : 'Invalid YAML',
        });
      }
    }
    return agents;
  }

  private scanConfigAgents(): Agent[] {
    if (!fs.existsSync(this.configPath)) return [];
    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(content) as { agent?: Record<string, AgentEntry> };
      const agents = config.agent ?? {};
      return Object.entries(agents).map(([name, entry]) => ({
        itemType: 'agent' as const,
        name,
        description: typeof entry.description === 'string' ? entry.description : '',
        mode: typeof entry.mode === 'string' ? entry.mode : '',
        model: typeof entry.model === 'string' ? entry.model : undefined,
        temperature: typeof entry.temperature === 'number' ? entry.temperature : undefined,
        promptFile: this.resolvePromptFile(entry.prompt),
        tools: this.asStringArray(entry.tools),
        source: 'config' as const,
        path: this.configPath,
        jsonPath: `agent.${name}`,
      }));
    } catch (err) {
      return [
        {
          itemType: 'agent',
          name: 'opencode.json',
          description: '',
          mode: '',
          source: 'config',
          path: this.configPath,
          error: err instanceof Error ? err.message : 'Failed to parse opencode.json',
        },
      ];
    }
  }

  private resolvePromptFile(prompt: unknown): string | undefined {
    let ref: string | undefined;
    if (typeof prompt === 'string') {
      ref = prompt;
    } else if (prompt && typeof prompt === 'object' && 'file' in prompt) {
      const file = (prompt as { file?: unknown }).file;
      if (typeof file === 'string') ref = file;
    }
    if (!ref) return undefined;
    const resolved = path.resolve(path.dirname(this.configPath), ref);
    return fs.existsSync(resolved) ? resolved : undefined;
  }

  private asStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const strings = value.filter((v): v is string => typeof v === 'string');
    return strings.length > 0 ? strings : undefined;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsc -p tsconfig.test.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scanner/AgentsScanner.ts src/test/fixtures/agents src/test/suite/agentsScanner.test.ts
git commit -m "feat: add agents scanner"
```

---

### Task 3: McpScanner + tests

**Files:**
- Create: `src/scanner/McpScanner.ts`
- Create: `src/test/fixtures/mcp/opencode.json`
- Create: `src/test/fixtures/mcp/project/.mcp.json`
- Create: `src/test/fixtures/mcp/broken/.mcp.json`
- Create: `src/test/suite/mcpScanner.test.ts`

**Interfaces:**
- Consumes: `McpServer`, `McpSource` from `../types.js`.
- Produces: `class McpScanner` with constructor `constructor(overrides: Partial<{ configPath: string; localMcpPath: string }> = {})` and `scanAll(workspaceRoot?: string): Promise<{ global: McpServer[]; project: McpServer[] }>`.

- [ ] **Step 1: Write the failing test**

Fixtures:

`src/test/fixtures/mcp/opencode.json`:
```json
{
  "mcp": {
    "ai-memory": { "type": "remote", "url": "http://127.0.0.1:49374/mcp", "enabled": true },
    "local-tool": { "type": "stdio", "command": "npx", "args": ["tool", "--serve"], "enabled": false }
  }
}
```

`src/test/fixtures/mcp/project/.mcp.json`:
```json
{
  "servers": {
    "project-db": { "type": "http", "url": "https://db.local/mcp" }
  }
}
```

`src/test/fixtures/mcp/broken/.mcp.json`:
```json
{ "servers": { "oops": {
```

`src/test/suite/mcpScanner.test.ts`:
```typescript
import * as assert from 'assert';
import * as path from 'path';
import { McpScanner } from '../../scanner/McpScanner.js';
import type { McpServer } from '../../types.js';

suite('McpScanner', () => {
  const fixturesDir = path.resolve(__dirname, '..', '..', '..', 'src', 'test', 'fixtures', 'mcp');
  const scanner = new McpScanner({ configPath: path.join(fixturesDir, 'opencode.json') });

  test('scans global mcp from opencode.json', async () => {
    const { global } = await scanner.scanAll(undefined);
    const remote = global.find((s: McpServer) => s.name === 'ai-memory');
    assert.ok(remote);
    assert.strictEqual(remote!.type, 'remote');
    assert.strictEqual(remote!.url, 'http://127.0.0.1:49374/mcp');
    assert.strictEqual(remote!.enabled, true);
  });

  test('parses stdio command and args', async () => {
    const { global } = await scanner.scanAll(undefined);
    const stdio = global.find((s: McpServer) => s.name === 'local-tool');
    assert.ok(stdio);
    assert.strictEqual(stdio!.command, 'npx');
    assert.deepStrictEqual(stdio!.args, ['tool', '--serve']);
    assert.strictEqual(stdio!.enabled, false);
  });

  test('enabled defaults to true', async () => {
    const { project } = await scanner.scanAll(path.join(fixturesDir, 'project'));
    const db = project.find((s: McpServer) => s.name === 'project-db');
    assert.ok(db);
    assert.strictEqual(db!.enabled, true);
    assert.strictEqual(db!.source, 'project');
  });

  test('project mcp read from .mcp.json servers key', async () => {
    const { project } = await scanner.scanAll(path.join(fixturesDir, 'project'));
    assert.strictEqual(project.length, 1);
    assert.strictEqual(project[0]!.name, 'project-db');
  });

  test('malformed .mcp.json yields error item', async () => {
    const { project } = await scanner.scanAll(path.join(fixturesDir, 'broken'));
    assert.ok(project.length >= 1);
    assert.ok(project[0]!.error);
  });

  test('missing config yields empty global', async () => {
    const empty = new McpScanner({ configPath: path.join(fixturesDir, 'missing.json') });
    const { global } = await empty.scanAll(undefined);
    assert.deepStrictEqual(global, []);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsc -p tsconfig.test.json`
Expected: FAIL — module `../../scanner/McpScanner.js` not found.

- [ ] **Step 3: Write `src/scanner/McpScanner.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import type { McpServer, McpSource } from '../types.js';

interface McpScannerOverrides {
  configPath: string;
  localMcpPath: string;
}

interface McpEntry {
  type?: unknown;
  url?: unknown;
  command?: unknown;
  args?: unknown;
  enabled?: unknown;
}

export class McpScanner {
  private readonly configPath: string;
  private readonly localMcpPath: string;

  constructor(overrides: Partial<McpScannerOverrides> = {}) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    this.configPath = overrides.configPath ?? path.join(home, '.config', 'opencode', 'opencode.json');
    this.localMcpPath = overrides.localMcpPath ?? '.mcp.json';
  }

  async scanAll(
    workspaceRoot?: string,
  ): Promise<{ global: McpServer[]; project: McpServer[] }> {
    return {
      global: this.scanConfig(),
      project: workspaceRoot ? this.scanLocal(path.join(workspaceRoot, this.localMcpPath)) : [],
    };
  }

  private scanConfig(): McpServer[] {
    if (!fs.existsSync(this.configPath)) return [];
    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(content) as { mcp?: Record<string, McpEntry> };
      return this.toServers(config.mcp ?? {}, 'global', this.configPath, 'mcp');
    } catch (err) {
      return [
        {
          itemType: 'mcp',
          name: 'opencode.json',
          type: 'unknown',
          enabled: false,
          source: 'global',
          path: this.configPath,
          error: err instanceof Error ? err.message : 'Failed to parse opencode.json',
        },
      ];
    }
  }

  private scanLocal(filePath: string): McpServer[] {
    if (!fs.existsSync(filePath)) return [];
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const config = JSON.parse(content) as {
        servers?: Record<string, McpEntry>;
        mcp?: Record<string, McpEntry>;
      };
      const section = config.servers ?? config.mcp ?? {};
      return this.toServers(section, 'project', filePath, 'servers');
    } catch (err) {
      return [
        {
          itemType: 'mcp',
          name: path.basename(filePath),
          type: 'unknown',
          enabled: false,
          source: 'project',
          path: filePath,
          error: err instanceof Error ? err.message : 'Failed to parse .mcp.json',
        },
      ];
    }
  }

  private toServers(
    entries: Record<string, McpEntry>,
    source: McpSource,
    pathValue: string,
    prefix: string,
  ): McpServer[] {
    return Object.entries(entries).map(([name, entry]) => ({
      itemType: 'mcp',
      name,
      type: typeof entry.type === 'string' ? entry.type : 'unknown',
      url: typeof entry.url === 'string' ? entry.url : undefined,
      command: typeof entry.command === 'string' ? entry.command : undefined,
      args: Array.isArray(entry.args)
        ? entry.args.filter((a): a is string => typeof a === 'string')
        : undefined,
      enabled: entry.enabled !== false,
      source,
      path: pathValue,
      jsonPath: `${prefix}.${name}`,
    }));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsc -p tsconfig.test.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scanner/McpScanner.ts src/test/fixtures/mcp src/test/suite/mcpScanner.test.ts
git commit -m "feat: add mcp scanner"
```

---

### Task 4: PromptsScanner + tests

**Files:**
- Create: `src/scanner/PromptsScanner.ts`
- Create: `src/test/fixtures/prompts/global-prompts/debug-fixer.txt`
- Create: `src/test/fixtures/prompts/global-instructions/AGENTS.md`
- Create: `src/test/fixtures/prompts/local/prompt/local-note.txt`
- Create: `src/test/suite/promptsScanner.test.ts`

**Interfaces:**
- Consumes: `PromptItem` from `../types.js`.
- Produces: `class PromptsScanner` with constructor `constructor(overrides: Partial<{ globalPromptsDir: string; globalInstructions: string[]; localPromptsDir: string }> = {})` and `scanAll(workspaceRoot?: string): Promise<{ global: PromptItem[]; local: PromptItem[] }>`.

- [ ] **Step 1: Write the failing test**

Fixtures:

`src/test/fixtures/prompts/global-prompts/debug-fixer.txt`:
```text
You are Debug Fixer.
You apply fixes from specs.
```
(15+ lines are fine; the scanner previews the first 40 lines.)

`src/test/fixtures/prompts/global-instructions/AGENTS.md`:
```markdown
# Global Instructions

Always run typecheck before committing.
```

`src/test/fixtures/prompts/local/prompt/local-note.txt`:
```text
Local workspace prompt.
```

`src/test/suite/promptsScanner.test.ts`:
```typescript
import * as assert from 'assert';
import * as path from 'path';
import { PromptsScanner } from '../../scanner/PromptsScanner.js';
import type { PromptItem } from '../../types.js';

suite('PromptsScanner', () => {
  const fixturesDir = path.resolve(__dirname, '..', '..', '..', 'src', 'test', 'fixtures', 'prompts');
  const scanner = new PromptsScanner({
    globalPromptsDir: path.join(fixturesDir, 'global-prompts'),
    globalInstructions: [path.join(fixturesDir, 'global-instructions', 'AGENTS.md')],
    localPromptsDir: '.opencode/prompt',
  });

  test('scans global prompt files', async () => {
    const { global } = await scanner.scanAll(undefined);
    const fixer = global.find((p: PromptItem) => p.name === 'debug-fixer');
    assert.ok(fixer);
    assert.strictEqual(fixer!.kind, 'prompt');
    assert.strictEqual(fixer!.source, 'global');
    assert.ok(fixer!.preview.includes('Debug Fixer'));
  });

  test('scans instruction files as instructions', async () => {
    const { global } = await scanner.scanAll(undefined);
    const agents = global.find((p: PromptItem) => p.name === 'AGENTS.md');
    assert.ok(agents);
    assert.strictEqual(agents!.kind, 'instruction');
  });

  test('scans local prompt files', async () => {
    const { local } = await scanner.scanAll(path.join(fixturesDir, 'local'));
    const note = local.find((p: PromptItem) => p.name === 'local-note');
    assert.ok(note);
    assert.strictEqual(note!.source, 'local');
  });

  test('ignores missing local directory', async () => {
    const scanner2 = new PromptsScanner({
      globalPromptsDir: path.join(fixturesDir, 'global-prompts'),
      globalInstructions: [],
      localPromptsDir: 'nonexistent',
    });
    const { local } = await scanner2.scanAll(path.join(fixturesDir, 'local'));
    assert.deepStrictEqual(local, []);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsc -p tsconfig.test.json`
Expected: FAIL — module `../../scanner/PromptsScanner.js` not found.

- [ ] **Step 3: Write `src/scanner/PromptsScanner.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import type { PromptItem, PromptSource, PromptKind } from '../types.js';

interface PromptsScannerOverrides {
  globalPromptsDir: string;
  globalInstructions: string[];
  localPromptsDir: string;
}

export class PromptsScanner {
  private readonly globalPromptsDir: string;
  private readonly globalInstructions: string[];
  private readonly localPromptsDir: string;
  private readonly previewLines = 40;

  constructor(overrides: Partial<PromptsScannerOverrides> = {}) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    this.globalPromptsDir =
      overrides.globalPromptsDir ?? path.join(home, '.config', 'opencode', 'prompts');
    this.globalInstructions =
      overrides.globalInstructions ??
      [
        path.join(home, '.config', 'opencode', 'AGENTS.md'),
        path.join(home, '.config', 'opencode', 'CLAUDE.md'),
      ];
    this.localPromptsDir = overrides.localPromptsDir ?? '.opencode/prompt';
  }

  async scanAll(workspaceRoot?: string): Promise<{ global: PromptItem[]; local: PromptItem[] }> {
    const global = this.scanPromptsDir(this.globalPromptsDir, 'global');
    for (const instructionPath of this.globalInstructions) {
      global.push(...this.scanInstruction(instructionPath, 'global'));
    }

    const local: PromptItem[] = [];
    if (workspaceRoot) {
      local.push(...this.scanPromptsDir(path.join(workspaceRoot, this.localPromptsDir), 'local'));
      for (const name of ['AGENTS.md', 'CLAUDE.md']) {
        local.push(...this.scanInstruction(path.join(workspaceRoot, name), 'local'));
      }
    }

    return { global, local };
  }

  private scanPromptsDir(dirPath: string, source: PromptSource): PromptItem[] {
    if (!fs.existsSync(dirPath)) return [];
    const items: PromptItem[] = [];
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.(txt|md)$/.test(entry.name)) continue;
      const filePath = path.join(dirPath, entry.name);
      const name = entry.name.replace(/\.(txt|md)$/, '');
      items.push(this.makeItem(filePath, name, 'prompt', source));
    }
    return items;
  }

  private scanInstruction(filePath: string, source: PromptSource): PromptItem[] {
    if (!fs.existsSync(filePath)) return [];
    return [this.makeItem(filePath, path.basename(filePath), 'instruction', source)];
  }

  private makeItem(
    filePath: string,
    name: string,
    kind: PromptKind,
    source: PromptSource,
  ): PromptItem {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const preview = content.split('\n').slice(0, this.previewLines).join('\n');
      return { itemType: 'prompt', name, kind, source, path: filePath, preview };
    } catch (err) {
      return {
        itemType: 'prompt',
        name,
        kind,
        source,
        path: filePath,
        preview: '',
        error: err instanceof Error ? err.message : 'Failed to read file',
      };
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsc -p tsconfig.test.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scanner/PromptsScanner.ts src/test/fixtures/prompts src/test/suite/promptsScanner.test.ts
git commit -m "feat: add prompts and instructions scanner"
```

---

### Task 5: Generic ContentTreeDataProvider + skills/commands factories

**Files:**
- Create: `src/tree/content.ts`
- Create: `src/tree/skills.ts`
- Create: `src/tree/commands.ts`
- Delete: `src/tree/SkillTreeDataProvider.ts`
- Delete: `src/tree/CommandsTreeDataProvider.ts`
- Rewrite: `src/test/suite/treeProvider.test.ts`
- Rewrite: `src/test/suite/commandsTreeProvider.test.ts`

**Interfaces:**
- Consumes: `Skill`, `Command`, `CommandGroup` from `../types` (no `.js` suffix in tree modules); `vscode`.
- Produces: from `src/tree/content.ts`: `ContentCategory<T>`, `ContentItemNode<T>`, `ContentNode<T>`, `ContentProviderConfig<T>`, `class ContentTreeDataProvider<T>`. From `src/tree/skills.ts`: `createSkillsView(): { provider: ContentTreeDataProvider<Skill>; setData(global: Skill[], local: Skill[]): void; refresh(): void }`. From `src/tree/commands.ts`: `createCommandsView(): { provider: ContentTreeDataProvider<Command>; setData(groups: CommandGroup[]): void; refresh(): void }`.

- [ ] **Step 1: Write the failing tests**

Rewrite `src/test/suite/treeProvider.test.ts`:

```typescript
import * as assert from 'assert';
import { createSkillsView } from '../../tree/skills';
import type { Skill } from '../../types';

suite('createSkillsView', () => {
  const globalSkill: Skill = {
    itemType: 'skill',
    name: 'test-global',
    description: 'A global skill',
    path: '/home/user/.config/opencode/skills/test-global/SKILL.md',
    enabled: true,
    source: 'global',
  };

  const localSkill: Skill = {
    itemType: 'skill',
    name: 'test-local',
    description: 'A local skill',
    path: '/workspace/.opencode/skills/test-local/SKILL.md',
    enabled: false,
    source: 'local',
  };

  test('root children are Global and Local category nodes', () => {
    const view = createSkillsView();
    view.setData([globalSkill], [localSkill]);
    const children = view.provider.getChildren();
    assert.strictEqual(children.length, 2);
    assert.strictEqual(children[0]!.label, 'Global Skills');
    assert.strictEqual(children[1]!.label, 'Local Skills');
  });

  test('category children return skill items', () => {
    const view = createSkillsView();
    view.setData([globalSkill], []);
    const root = view.provider.getChildren();
    const globalNode = root.find((n) => n.label === 'Global Skills');
    const skills = view.provider.getChildren(globalNode);
    assert.strictEqual(skills.length, 1);
    assert.strictEqual(skills[0]!.type, 'item');
    assert.strictEqual(skills[0]!.item.name, 'test-global');
  });

  test('checkboxState reflects enabled status', () => {
    const view = createSkillsView();
    view.setData([globalSkill], []);
    const root = view.provider.getChildren();
    const globalNode = root.find((n) => n.label === 'Global Skills');
    const skills = view.provider.getChildren(globalNode);
    assert.strictEqual(view.provider.getTreeItem(skills[0]!).checkboxState, 1);
  });

  test('disabled skill has Unchecked checkboxState', () => {
    const view = createSkillsView();
    view.setData([], [localSkill]);
    const root = view.provider.getChildren();
    const localNode = root.find((n) => n.label === 'Local Skills');
    const skills = view.provider.getChildren(localNode);
    assert.strictEqual(view.provider.getTreeItem(skills[0]!).checkboxState, 0);
  });

  test('hides empty categories', () => {
    const view = createSkillsView();
    view.setData([globalSkill], []);
    const root = view.provider.getChildren();
    assert.strictEqual(root.length, 1);
    assert.strictEqual(root[0]!.label, 'Global Skills');
  });

  test('counts shown in category labels', () => {
    const view = createSkillsView();
    view.setData([globalSkill, globalSkill], []);
    const root = view.provider.getChildren();
    const globalNode = root.find((n) => n.label === 'Global Skills');
    const item = view.provider.getTreeItem(globalNode!);
    assert.ok((item.label as string).includes('(2)'));
  });

  test('skill items carry contextValue skill', () => {
    const view = createSkillsView();
    view.setData([globalSkill], []);
    const root = view.provider.getChildren();
    const globalNode = root.find((n) => n.label === 'Global Skills');
    const skills = view.provider.getChildren(globalNode);
    assert.strictEqual(view.provider.getTreeItem(skills[0]!).contextValue, 'skill');
  });
});
```

Rewrite `src/test/suite/commandsTreeProvider.test.ts`:

```typescript
import * as assert from 'assert';
import { createCommandsView } from '../../tree/commands';
import type { CommandGroup } from '../../types';

suite('createCommandsView', () => {
  const mockGroups: CommandGroup[] = [
    {
      source: 'file',
      label: 'From File',
      commands: [
        {
          itemType: 'command',
          name: 'test-cmd',
          description: 'A test command',
          source: 'file',
          path: '/home/user/.config/opencode/commands/test-cmd.md',
          template: 'echo hello',
        },
      ],
    },
    {
      source: 'json',
      label: 'From opencode.json',
      commands: [
        {
          itemType: 'command',
          name: 'inline-cmd',
          description: 'An inline command',
          source: 'json',
          path: '/home/user/.config/opencode/opencode.json',
          template: 'do something',
          jsonPath: 'command.inline-cmd',
        },
      ],
    },
  ];

  test('returns categories as root children with counts', () => {
    const view = createCommandsView();
    view.setData(mockGroups);
    const children = view.provider.getChildren();
    assert.strictEqual(children.length, 2);
    assert.strictEqual(children[0]!.type, 'category');
    assert.strictEqual(children[0]!.label, 'From File');
    assert.strictEqual(children[0]!.count, 1);
  });

  test('hides empty groups', () => {
    const view = createCommandsView();
    view.setData([
      { source: 'file', label: 'From File', commands: [] },
      { source: 'json', label: 'From opencode.json', commands: [] },
    ]);
    assert.strictEqual(view.provider.getChildren().length, 0);
  });

  test('category children are command items', () => {
    const view = createCommandsView();
    view.setData(mockGroups);
    const fileCat = view.provider.getChildren()[0]!;
    const commands = view.provider.getChildren(fileCat);
    assert.strictEqual(commands.length, 1);
    assert.strictEqual(commands[0]!.type, 'item');
    assert.strictEqual(commands[0]!.item.name, 'test-cmd');
  });

  test('getTreeItem returns contextValue command and description', () => {
    const view = createCommandsView();
    view.setData(mockGroups);
    const fileCat = view.provider.getChildren()[0]!;
    const commands = view.provider.getChildren(fileCat);
    const item = view.provider.getTreeItem(commands[0]!);
    assert.strictEqual(item.contextValue, 'command');
    assert.strictEqual(item.description, 'A test command');
  });

  test('errored command has warning icon', () => {
    const view = createCommandsView();
    view.setData([
      {
        source: 'file',
        label: 'From File',
        commands: [
          {
            itemType: 'command',
            name: 'broken',
            description: '',
            source: 'file',
            path: '/tmp/broken.md',
            error: 'YAML parse error',
          },
        ],
      },
    ]);
    const fileCat = view.provider.getChildren()[0]!;
    const commands = view.provider.getChildren(fileCat);
    assert.ok(view.provider.getTreeItem(commands[0]!).iconPath);
  });

  test('refresh fires onDidChangeTreeData', () => {
    const view = createCommandsView();
    let fired = false;
    const disposable = view.provider.onDidChangeTreeData(() => {
      fired = true;
    });
    view.refresh();
    assert.strictEqual(fired, true);
    disposable.dispose();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsc -p tsconfig.test.json`
Expected: FAIL — `../../tree/skills` and `../../tree/commands` not found.

- [ ] **Step 3: Write `src/tree/content.ts`**

```typescript
import * as vscode from 'vscode';

export interface ContentCategory<T> {
  type: 'category';
  key: string;
  label: string;
  count: number;
}

export interface ContentItemNode<T> {
  type: 'item';
  item: T;
}

export type ContentNode<T> = ContentCategory<T> | ContentItemNode<T>;

export interface ContentProviderConfig<T> {
  getCategories: () => ContentCategory<T>[];
  getCategoryChildren: (category: ContentCategory<T>) => ContentItemNode<T>[];
  toTreeItem: (item: T) => vscode.TreeItem;
}

export class ContentTreeDataProvider<T> implements vscode.TreeDataProvider<ContentNode<T>> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ContentNode<T> | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly config: ContentProviderConfig<T>) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ContentNode<T>): vscode.TreeItem {
    if (element.type === 'category') {
      const item = new vscode.TreeItem(
        `${element.label} (${element.count})`,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.contextValue = 'category';
      return item;
    }
    return this.config.toTreeItem(element.item);
  }

  getChildren(element?: ContentNode<T>): ContentNode<T>[] {
    if (!element) {
      return this.config.getCategories();
    }
    if (element.type === 'category') {
      return this.config.getCategoryChildren(element);
    }
    return [];
  }
}
```

- [ ] **Step 4: Write `src/tree/skills.ts`**

```typescript
import * as vscode from 'vscode';
import { ContentTreeDataProvider, type ContentCategory, type ContentProviderConfig } from './content';
import type { Skill } from '../types';

export interface SkillsView {
  provider: ContentTreeDataProvider<Skill>;
  setData(global: Skill[], local: Skill[]): void;
  refresh(): void;
}

export function createSkillsView(): SkillsView {
  let global: Skill[] = [];
  let local: Skill[] = [];

  const config: ContentProviderConfig<Skill> = {
    getCategories: () => {
      const categories: ContentCategory<Skill>[] = [];
      if (global.length > 0) {
        categories.push({ type: 'category', key: 'global', label: 'Global Skills', count: global.length });
      }
      if (local.length > 0) {
        categories.push({ type: 'category', key: 'local', label: 'Local Skills', count: local.length });
      }
      return categories;
    },
    getCategoryChildren: (category) => {
      const skills = category.key === 'global' ? global : local;
      return skills.map((skill) => ({ type: 'item', item: skill }));
    },
    toTreeItem: (skill) => {
      const item = new vscode.TreeItem(skill.name);
      item.contextValue = 'skill';
      item.checkboxState = skill.enabled
        ? vscode.TreeItemCheckboxState.Checked
        : vscode.TreeItemCheckboxState.Unchecked;
      item.description = skill.path;
      item.tooltip = skill.description || skill.name;
      if (skill.yamlError) {
        item.iconPath = new vscode.ThemeIcon('warning');
      }
      return item;
    },
  };

  const provider = new ContentTreeDataProvider<Skill>(config);
  return {
    provider,
    setData: (g, l) => {
      global = g;
      local = l;
      provider.refresh();
    },
    refresh: () => provider.refresh(),
  };
}
```

- [ ] **Step 5: Write `src/tree/commands.ts`**

```typescript
import * as vscode from 'vscode';
import { ContentTreeDataProvider, type ContentCategory, type ContentProviderConfig } from './content';
import type { Command, CommandGroup } from '../types';

export interface CommandsView {
  provider: ContentTreeDataProvider<Command>;
  setData(groups: CommandGroup[]): void;
  refresh(): void;
}

export function createCommandsView(): CommandsView {
  let groups: CommandGroup[] = [];

  const config: ContentProviderConfig<Command> = {
    getCategories: () => {
      return groups
        .filter((group) => group.commands.length > 0)
        .map((group) => ({
          type: 'category' as const,
          key: group.source,
          label: group.label,
          count: group.commands.length,
        }));
    },
    getCategoryChildren: (category) => {
      const group = groups.find((g) => g.source === category.key);
      return (group?.commands ?? []).map((command) => ({ type: 'item', item: command }));
    },
    toTreeItem: (command) => {
      const item = new vscode.TreeItem(command.name);
      item.contextValue = 'command';
      item.description = command.description || undefined;
      item.tooltip = command.template || command.description || command.name;
      item.iconPath = command.error
        ? new vscode.ThemeIcon('warning')
        : command.source === 'file'
          ? new vscode.ThemeIcon('file')
          : new vscode.ThemeIcon('json');
      return item;
    },
  };

  const provider = new ContentTreeDataProvider<Command>(config);
  return {
    provider,
    setData: (g) => {
      groups = g;
      provider.refresh();
    },
    refresh: () => provider.refresh(),
  };
}
```

- [ ] **Step 6: Delete the old providers**

Delete `src/tree/SkillTreeDataProvider.ts` and `src/tree/CommandsTreeDataProvider.ts`.

- [ ] **Step 7: Run test to verify it passes**

Run: `npx tsc -p tsconfig.test.json`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/tree/content.ts src/tree/skills.ts src/tree/commands.ts src/test/suite/treeProvider.test.ts src/test/suite/commandsTreeProvider.test.ts src/tree/SkillTreeDataProvider.ts src/tree/CommandsTreeDataProvider.ts
git commit -m "refactor: replace tree providers with generic provider"
```

---

### Task 6: Agent / MCP / Prompts view factories + tests

**Files:**
- Create: `src/tree/agents.ts`
- Create: `src/tree/mcp.ts`
- Create: `src/tree/prompts.ts`
- Create: `src/test/suite/agentsView.test.ts`
- Create: `src/test/suite/mcpView.test.ts`
- Create: `src/test/suite/promptsView.test.ts`

**Interfaces:**
- Consumes: `ContentTreeDataProvider`, `ContentProviderConfig`, `ContentCategory` from `./content`; `Agent`, `McpServer`, `PromptItem` from `../types`.
- Produces:
  - `createAgentsView(): { provider: ContentTreeDataProvider<Agent>; setData(config: Agent[], global: Agent[], local: Agent[]): void; refresh(): void }`
  - `createMcpView(): { provider: ContentTreeDataProvider<McpServer>; setData(global: McpServer[], project: McpServer[]): void; refresh(): void }`
  - `createPromptsView(): { provider: ContentTreeDataProvider<PromptItem>; setData(global: PromptItem[], local: PromptItem[]): void; refresh(): void }`

- [ ] **Step 1: Write the failing tests**

`src/test/suite/agentsView.test.ts`:
```typescript
import * as assert from 'assert';
import { createAgentsView } from '../../tree/agents';
import type { Agent } from '../../types';

suite('createAgentsView', () => {
  const configAgent: Agent = {
    itemType: 'agent',
    name: 'architect',
    description: 'Reviews architecture',
    mode: 'primary',
    model: 'opencode/deepseek-v4-pro',
    source: 'config',
    path: '/home/user/.config/opencode/opencode.json',
    jsonPath: 'agent.architect',
  };
  const localAgent: Agent = {
    itemType: 'agent',
    name: 'local-agent',
    description: '',
    mode: '',
    source: 'local',
    path: '/ws/.opencode/agent/local-agent.md',
  };

  test('root categories from config/global/local', () => {
    const view = createAgentsView();
    view.setData([configAgent], [], [localAgent]);
    const children = view.provider.getChildren();
    assert.strictEqual(children.length, 2);
    assert.strictEqual(children[0]!.label, 'From Config');
    assert.strictEqual(children[1]!.label, 'Local Agents');
  });

  test('item tree item has contextValue agent and account icon', () => {
    const view = createAgentsView();
    view.setData([configAgent], [], []);
    const root = view.provider.getChildren();
    const cat = root[0]!;
    const items = view.provider.getChildren(cat);
    const item = view.provider.getTreeItem(items[0]!);
    assert.strictEqual(item.contextValue, 'agent');
    assert.ok(item.iconPath);
  });
});
```

`src/test/suite/mcpView.test.ts`:
```typescript
import * as assert from 'assert';
import { createMcpView } from '../../tree/mcp';
import type { McpServer } from '../../types';

suite('createMcpView', () => {
  const global: McpServer = {
    itemType: 'mcp',
    name: 'ai-memory',
    type: 'remote',
    url: 'http://127.0.0.1:49374/mcp',
    enabled: true,
    source: 'global',
    path: '/home/user/.config/opencode/opencode.json',
    jsonPath: 'mcp.ai-memory',
  };
  const project: McpServer = {
    itemType: 'mcp',
    name: 'db',
    type: 'stdio',
    command: 'npx',
    args: ['db'],
    enabled: false,
    source: 'project',
    path: '/ws/.mcp.json',
    jsonPath: 'servers.db',
  };

  test('root categories Global/Project', () => {
    const view = createMcpView();
    view.setData([global], [project]);
    const children = view.provider.getChildren();
    assert.strictEqual(children.length, 2);
    assert.strictEqual(children[0]!.label, 'Global');
    assert.strictEqual(children[1]!.label, 'Project');
  });

  test('item description reflects enabled status', () => {
    const view = createMcpView();
    view.setData([global], [project]);
    const root = view.provider.getChildren();
    const cat = root[0]!;
    const items = view.provider.getChildren(cat);
    assert.strictEqual(view.provider.getTreeItem(items[0]!).description, 'enabled');
    const projectCat = root[1]!;
    const projectItems = view.provider.getChildren(projectCat);
    assert.strictEqual(view.provider.getTreeItem(projectItems[0]!).description, 'disabled');
  });

  test('item contextValue is mcp', () => {
    const view = createMcpView();
    view.setData([global], []);
    const root = view.provider.getChildren();
    const cat = root[0]!;
    const items = view.provider.getChildren(cat);
    assert.strictEqual(view.provider.getTreeItem(items[0]!).contextValue, 'mcp');
  });
});
```

`src/test/suite/promptsView.test.ts`:
```typescript
import * as assert from 'assert';
import { createPromptsView } from '../../tree/prompts';
import type { PromptItem } from '../../types';

suite('createPromptsView', () => {
  const globalPrompt: PromptItem = {
    itemType: 'prompt',
    name: 'debug-fixer',
    kind: 'prompt',
    source: 'global',
    path: '/home/user/.config/opencode/prompts/debug-fixer.txt',
    preview: 'You are Debug Fixer.',
  };
  const localInstruction: PromptItem = {
    itemType: 'prompt',
    name: 'AGENTS.md',
    kind: 'instruction',
    source: 'local',
    path: '/ws/AGENTS.md',
    preview: '# Instructions',
  };

  test('root categories from prompts and instructions', () => {
    const view = createPromptsView();
    view.setData([globalPrompt], [localInstruction]);
    const children = view.provider.getChildren();
    assert.strictEqual(children.length, 2);
    assert.strictEqual(children[0]!.label, 'Prompts — Global');
    assert.strictEqual(children[1]!.label, 'Instructions — Local');
  });

  test('prompt items use file-text icon, instructions use book', () => {
    const view = createPromptsView();
    view.setData([globalPrompt], [localInstruction]);
    const promptCat = view.provider.getChildren()[0]!;
    const instructionCat = view.provider.getChildren()[1]!;
    const promptIcon = view.provider.getTreeItem(view.provider.getChildren(promptCat)[0]!).iconPath;
    const instructionIcon = view.provider.getTreeItem(view.provider.getChildren(instructionCat)[0]!).iconPath;
    assert.ok(promptIcon);
    assert.ok(instructionIcon);
    assert.notStrictEqual(
      JSON.stringify(promptIcon),
      JSON.stringify(instructionIcon),
    );
  });

  test('item contextValue is prompt', () => {
    const view = createPromptsView();
    view.setData([globalPrompt], []);
    const promptCat = view.provider.getChildren()[0]!;
    const item = view.provider.getChildren(promptCat)[0]!;
    assert.strictEqual(view.provider.getTreeItem(item).contextValue, 'prompt');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsc -p tsconfig.test.json`
Expected: FAIL — `../../tree/agents`, `../../tree/mcp`, `../../tree/prompts` not found.

- [ ] **Step 3: Write `src/tree/agents.ts`**

```typescript
import * as vscode from 'vscode';
import { ContentTreeDataProvider, type ContentCategory, type ContentProviderConfig } from './content';
import type { Agent } from '../types';

export interface AgentsView {
  provider: ContentTreeDataProvider<Agent>;
  setData(config: Agent[], global: Agent[], local: Agent[]): void;
  refresh(): void;
}

export function createAgentsView(): AgentsView {
  let configAgents: Agent[] = [];
  let globalAgents: Agent[] = [];
  let localAgents: Agent[] = [];

  const config: ContentProviderConfig<Agent> = {
    getCategories: () => {
      const categories: ContentCategory<Agent>[] = [];
      if (configAgents.length > 0) {
        categories.push({ type: 'category', key: 'config', label: 'From Config', count: configAgents.length });
      }
      if (globalAgents.length > 0) {
        categories.push({ type: 'category', key: 'global', label: 'Global Agents', count: globalAgents.length });
      }
      if (localAgents.length > 0) {
        categories.push({ type: 'category', key: 'local', label: 'Local Agents', count: localAgents.length });
      }
      return categories;
    },
    getCategoryChildren: (category) => {
      const agents =
        category.key === 'config' ? configAgents : category.key === 'global' ? globalAgents : localAgents;
      return agents.map((agent) => ({ type: 'item', item: agent }));
    },
    toTreeItem: (agent) => {
      const item = new vscode.TreeItem(agent.name);
      item.contextValue = 'agent';
      item.description = agent.mode || undefined;
      item.tooltip = agent.description || agent.name;
      item.iconPath = agent.error ? new vscode.ThemeIcon('warning') : new vscode.ThemeIcon('account');
      return item;
    },
  };

  const provider = new ContentTreeDataProvider<Agent>(config);
  return {
    provider,
    setData: (c, g, l) => {
      configAgents = c;
      globalAgents = g;
      localAgents = l;
      provider.refresh();
    },
    refresh: () => provider.refresh(),
  };
}
```

- [ ] **Step 4: Write `src/tree/mcp.ts`**

```typescript
import * as vscode from 'vscode';
import { ContentTreeDataProvider, type ContentCategory, type ContentProviderConfig } from './content';
import type { McpServer } from '../types';

export interface McpView {
  provider: ContentTreeDataProvider<McpServer>;
  setData(global: McpServer[], project: McpServer[]): void;
  refresh(): void;
}

export function createMcpView(): McpView {
  let global: McpServer[] = [];
  let project: McpServer[] = [];

  const config: ContentProviderConfig<McpServer> = {
    getCategories: () => {
      const categories: ContentCategory<McpServer>[] = [];
      if (global.length > 0) {
        categories.push({ type: 'category', key: 'global', label: 'Global', count: global.length });
      }
      if (project.length > 0) {
        categories.push({ type: 'category', key: 'project', label: 'Project', count: project.length });
      }
      return categories;
    },
    getCategoryChildren: (category) => {
      const servers = category.key === 'global' ? global : project;
      return servers.map((server) => ({ type: 'item', item: server }));
    },
    toTreeItem: (server) => {
      const item = new vscode.TreeItem(server.name);
      item.contextValue = 'mcp';
      item.description = server.enabled ? 'enabled' : 'disabled';
      item.tooltip = server.url ?? server.command ?? server.name;
      item.iconPath = server.error ? new vscode.ThemeIcon('warning') : new vscode.ThemeIcon('plug');
      return item;
    },
  };

  const provider = new ContentTreeDataProvider<McpServer>(config);
  return {
    provider,
    setData: (g, p) => {
      global = g;
      project = p;
      provider.refresh();
    },
    refresh: () => provider.refresh(),
  };
}
```

- [ ] **Step 5: Write `src/tree/prompts.ts`**

```typescript
import * as vscode from 'vscode';
import { ContentTreeDataProvider, type ContentCategory, type ContentProviderConfig } from './content';
import type { PromptItem } from '../types';

export interface PromptsView {
  provider: ContentTreeDataProvider<PromptItem>;
  setData(global: PromptItem[], local: PromptItem[]): void;
  refresh(): void;
}

export function createPromptsView(): PromptsView {
  let global: PromptItem[] = [];
  let local: PromptItem[] = [];

  const config: ContentProviderConfig<PromptItem> = {
    getCategories: () => {
      const categories: ContentCategory<PromptItem>[] = [];
      const add = (key: string, label: string, items: PromptItem[]) => {
        if (items.length > 0) {
          categories.push({ type: 'category', key, label, count: items.length });
        }
      };
      add('prompt-global', 'Prompts — Global', global.filter((i) => i.kind === 'prompt'));
      add('prompt-local', 'Prompts — Local', local.filter((i) => i.kind === 'prompt'));
      add('instruction-global', 'Instructions — Global', global.filter((i) => i.kind === 'instruction'));
      add('instruction-local', 'Instructions — Local', local.filter((i) => i.kind === 'instruction'));
      return categories;
    },
    getCategoryChildren: (category) => {
      const source = category.key.endsWith('-global') ? global : local;
      const kind = category.key.startsWith('prompt') ? 'prompt' : 'instruction';
      return source
        .filter((i) => i.kind === kind)
        .map((item) => ({ type: 'item', item }));
    },
    toTreeItem: (item) => {
      const treeItem = new vscode.TreeItem(item.name);
      treeItem.contextValue = 'prompt';
      treeItem.description = item.source;
      treeItem.iconPath = item.kind === 'instruction'
        ? new vscode.ThemeIcon('book')
        : new vscode.ThemeIcon('file-text');
      return treeItem;
    },
  };

  const provider = new ContentTreeDataProvider<PromptItem>(config);
  return {
    provider,
    setData: (g, l) => {
      global = g;
      local = l;
      provider.refresh();
    },
    refresh: () => provider.refresh(),
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx tsc -p tsconfig.test.json`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/tree/agents.ts src/tree/mcp.ts src/tree/prompts.ts src/test/suite/agentsView.test.ts src/test/suite/mcpView.test.ts src/test/suite/promptsView.test.ts
git commit -m "feat: add agent, mcp and prompts view factories"
```

---

### Task 7: DetailPanel refactor — html helper + skill/command renderers

**Files:**
- Create: `src/panel/html.ts`
- Create: `src/panel/renderers/skill.ts`
- Create: `src/panel/renderers/command.ts`
- Rewrite: `src/panel/DetailPanel.ts`

**Interfaces:**
- Consumes: `Skill`, `Command` from `../../types`; `vscode`.
- Produces: from `src/panel/html.ts`: `getNonce(): string`, `getCsp(webview: vscode.Webview, nonce: string): string`, `escapeHtml(str: string): string`, `escapeAttr(str: string): string`, `htmlHead(webview: vscode.Webview, nonce: string): string`, `htmlFooter(nonce: string): string`. From `src/panel/renderers/skill.ts`: `renderSkill(webview: vscode.Webview, nonce: string, skill: Skill): string`. From `src/panel/renderers/command.ts`: `renderCommand(webview: vscode.Webview, nonce: string, command: Command): string`. `DetailPanel.show(item: DetailItem): void`.

- [ ] **Step 1: Write `src/panel/html.ts`**

```typescript
import * as vscode from 'vscode';

export function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function getCsp(webview: vscode.Webview, nonce: string): string {
  return `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;`;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

export function badge(style: string, text: string): string {
  return `<span style="${style}">${escapeHtml(text)}</span>`;
}

export const BADGE_OK = 'background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);padding:1px 6px;border-radius:8px;font-size:10px';
export const BADGE_ERROR = 'background:var(--vscode-inputValidation-errorBackground);color:var(--vscode-inputValidation-errorForeground);padding:1px 6px;border-radius:8px;font-size:10px';

export function errorBlock(label: string, message: string): string {
  return `<div style="margin-top:8px;padding:8px;background:var(--vscode-inputValidation-errorBackground);border:1px solid var(--vscode-inputValidation-errorBorder);border-radius:4px;font-size:11px"><strong>⚠️ ${escapeHtml(label)}:</strong> ${escapeHtml(message)}</div>`;
}

export function htmlHead(webview: vscode.Webview, nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${getCsp(webview, nonce)}">
  <title>Details</title>
  <style>
    body { padding: 12px; color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); background: var(--vscode-editor-background); }
    h2 { margin: 0 0 4px 0; font-size: 14px; font-weight: 600; }
    .path { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; word-break: break-all; }
    .desc { font-size: 12px; color: var(--vscode-foreground); margin-bottom: 12px; line-height: 1.4; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    button { padding: 3px 10px; border: none; border-radius: 2px; cursor: pointer; font-size: 11px; font-family: var(--vscode-font-family); background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 8px; flex-wrap: wrap; }
    .header-badges { display: flex; gap: 4px; }
    .type-badge { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 1px 6px; border-radius: 8px; font-size: 10px; }
    .badge-file { background: #2d5f2d; color: #89d185; padding: 1px 6px; border-radius: 8px; font-size: 10px; }
    .badge-json { background: #5a3d1e; color: #e8ab5e; padding: 1px 6px; border-radius: 8px; font-size: 10px; }
    hr { border: none; border-top: 1px solid var(--vscode-sideBarSectionHeader-border); margin: 8px 0; }
    .label { font-size: 10px; text-transform: uppercase; color: var(--vscode-descriptionForeground); letter-spacing: 0.5px; margin-bottom: 4px; }
    pre { background: var(--vscode-textBlockQuote-background); padding: 12px; border-radius: 4px; font-size: 11px; color: var(--vscode-foreground); max-height: 200px; overflow-y: auto; white-space: pre-wrap; line-height: 1.4; margin: 0 0 12px; }
    code { font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; color: var(--vscode-textPreformat-foreground); word-break: break-all; }
    .chips { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 12px; }
    .chip { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 1px 6px; border-radius: 8px; font-size: 10px; }
    .empty { display: flex; align-items: center; justify-content: center; min-height: 60px; color: var(--vscode-descriptionForeground); font-size: 12px; }
  </style>
</head>
<body>`;
}

export function htmlFooter(nonce: string): string {
  return `<script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function openFile(path) { vscode.postMessage({ command: 'openFile', path }); }
    function copyPath(path) { vscode.postMessage({ command: 'copyPath', path }); }
  </script>
</body>
</html>`;
}
```

- [ ] **Step 2: Write `src/panel/renderers/skill.ts`**

```typescript
import type * as vscode from 'vscode';
import { htmlHead, htmlFooter, escapeHtml, escapeAttr, badge, BADGE_OK, BADGE_ERROR, errorBlock } from '../html';
import type { Skill } from '../../types';

export function renderSkill(webview: vscode.Webview, nonce: string, skill: Skill): string {
  const warningIcon = skill.yamlError ? '⚠️ ' : '';
  const enabledBadge = badge(skill.enabled ? BADGE_OK : BADGE_ERROR, skill.enabled ? 'enabled' : 'disabled');
  const error = skill.yamlError ? errorBlock('YAML Error', skill.yamlError) : '';

  const body = `
  <div class="header-row">
    <h2>${warningIcon}${escapeHtml(skill.name)}</h2>
    ${enabledBadge}
  </div>
  <div class="path">${escapeHtml(skill.path)}</div>
  <span class="type-badge">${escapeHtml(skill.source)}</span>
  ${skill.description ? `<hr><div class="label">DESCRIPTION</div><div class="desc">${escapeHtml(skill.description)}</div>` : ''}
  ${error}
  <hr>
  <div class="actions">
    <button onclick="openFile('${escapeAttr(skill.path)}')">📂 Open SKILL.md</button>
    <button onclick="copyPath('${escapeAttr(skill.path)}')">📋 Copy Path</button>
  </div>`;

  return `${htmlHead(webview, nonce)}${body}${htmlFooter(nonce)}`;
}
```

- [ ] **Step 3: Write `src/panel/renderers/command.ts`**

```typescript
import type * as vscode from 'vscode';
import { htmlHead, htmlFooter, escapeHtml, escapeAttr, badge, BADGE_OK, errorBlock } from '../html';
import type { Command } from '../../types';

export function renderCommand(webview: vscode.Webview, nonce: string, command: Command): string {
  const error = command.error ? errorBlock('Error', command.error) : '';
  const sourceBadge =
    command.source === 'file'
      ? `<span class="badge-file">File</span>`
      : `<span class="badge-json">JSON config</span>`;
  const templateSection = command.template
    ? `<div class="label">TEMPLATE</div><pre>${escapeHtml(command.template)}</pre>`
    : '';
  const sourceInfo =
    command.source === 'file'
      ? `<div class="label">SOURCE</div><code>${escapeHtml(command.path || '')}</code>`
      : `<div class="label">DEFINED IN</div><code>${escapeHtml(command.path || '')} → ${escapeHtml(command.jsonPath || '')}</code>`;
  const openButton = command.path
    ? `<button onclick="openFile('${escapeAttr(command.path)}')">📂 ${command.source === 'file' ? 'Open File' : 'Open opencode.json'}</button>`
    : '';
  const copyButton = command.path
    ? `<button onclick="copyPath('${escapeAttr(command.path)}')">📋 Copy Path</button>`
    : '';

  const body = `
  <div class="header-row">
    <h2>${escapeHtml(command.name)}</h2>
    <div class="header-badges">
      ${badge(BADGE_OK, 'COMMAND')}
      ${sourceBadge}
    </div>
  </div>
  ${command.description ? `<div class="desc">${escapeHtml(command.description)}</div>` : ''}
  ${error}
  ${templateSection}
  <hr>
  ${sourceInfo}
  <hr>
  <div class="actions">
    ${openButton}
    ${copyButton}
  </div>`;

  return `${htmlHead(webview, nonce)}${body}${htmlFooter(nonce)}`;
}
```

- [ ] **Step 4: Rewrite `src/panel/DetailPanel.ts`**

```typescript
import * as vscode from 'vscode';
import { htmlHead, htmlFooter, getNonce } from './html';
import { renderSkill } from './renderers/skill';
import { renderCommand } from './renderers/command';
import { renderAgent } from './renderers/agent';
import { renderMcp } from './renderers/mcp';
import { renderPrompt } from './renderers/prompt';
import type { DetailItem } from '../types';

export class DetailPanel implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [],
    };
    webviewView.webview.html = this.renderEmpty(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message) => {
      if (
        message.command === 'openFile' &&
        typeof message.path === 'string' &&
        message.path.length > 0
      ) {
        const uri = vscode.Uri.file(message.path);
        vscode.commands.executeCommand('vscode.open', uri);
      } else if (
        message.command === 'copyPath' &&
        typeof message.path === 'string' &&
        message.path.length > 0
      ) {
        vscode.env.clipboard.writeText(message.path);
        vscode.window.showInformationMessage('Path copied to clipboard');
      }
    });
  }

  show(item: DetailItem): void {
    if (!this._view) return;
    this._view.show(true);
    const webview = this._view.webview;
    const nonce = getNonce();
    switch (item.itemType) {
      case 'skill':
        this._view.webview.html = renderSkill(webview, nonce, item);
        break;
      case 'command':
        this._view.webview.html = renderCommand(webview, nonce, item);
        break;
      case 'agent':
        this._view.webview.html = renderAgent(webview, nonce, item);
        break;
      case 'mcp':
        this._view.webview.html = renderMcp(webview, nonce, item);
        break;
      case 'prompt':
        this._view.webview.html = renderPrompt(webview, nonce, item);
        break;
    }
  }

  clear(): void {
    if (!this._view) return;
    this._view.webview.html = this.renderEmpty(this._view.webview);
  }

  private renderEmpty(webview: vscode.Webview): string {
    const nonce = getNonce();
    return `${htmlHead(webview, nonce)}<div class="empty">Select an item to view details</div>${htmlFooter(nonce)}`;
  }
}
```

> Note: `renderAgent`, `renderMcp`, `renderPrompt` are created in Task 8. Until then this file will not compile; Task 8 completes it.

- [ ] **Step 5: Run tests to confirm expected failure**

Run: `npx tsc --noEmit`
Expected: FAIL — missing `renderers/agent`, `renderers/mcp`, `renderers/prompt`. This is expected and resolved in Task 8. Proceed to Task 8 before committing Task 7, or commit the html + skill/command renderers first (they compile independently) and finish DetailPanel in Task 8.

Recommendation: commit Task 7 in two commits — (a) `src/panel/html.ts` + `src/panel/renderers/skill.ts` + `src/panel/renderers/command.ts`, (b) DetailPanel rewrite together with Task 8's renderers.

- [ ] **Step 6: Commit (part a)**

```bash
git add src/panel/html.ts src/panel/renderers/skill.ts src/panel/renderers/command.ts
git commit -m "refactor: extract shared webview html helpers and skill/command renderers"
```

---

### Task 8: Agent / MCP / Prompt renderers

**Files:**
- Create: `src/panel/renderers/agent.ts`
- Create: `src/panel/renderers/mcp.ts`
- Create: `src/panel/renderers/prompt.ts`
- Finish: `src/panel/DetailPanel.ts` (Task 7 rewrite is now complete)

**Interfaces:**
- Consumes: `htmlHead`, `htmlFooter`, `escapeHtml`, `escapeAttr`, `badge`, `BADGE_OK`, `BADGE_ERROR`, `errorBlock` from `../html`; `Agent`, `McpServer`, `PromptItem` from `../../types`.
- Produces: `renderAgent(webview, nonce, agent): string`, `renderMcp(webview, nonce, server): string`, `renderPrompt(webview, nonce, item): string`.

- [ ] **Step 1: Write `src/panel/renderers/agent.ts`**

```typescript
import type * as vscode from 'vscode';
import { htmlHead, htmlFooter, escapeHtml, escapeAttr, badge, BADGE_OK, BADGE_ERROR, errorBlock } from '../html';
import type { Agent } from '../../types';

export function renderAgent(webview: vscode.Webview, nonce: string, agent: Agent): string {
  const modeBadge = agent.mode
    ? badge(BADGE_OK, agent.mode)
    : '';
  const error = agent.error ? errorBlock('Error', agent.error) : '';
  const metaRows = [
    agent.model ? `<div class="label">MODEL</div><div class="desc">${escapeHtml(agent.model)}</div>` : '',
    agent.temperature !== undefined
      ? `<div class="label">TEMPERATURE</div><div class="desc">${escapeHtml(String(agent.temperature))}</div>`
      : '',
  ].join('');
  const toolsChips = agent.tools?.length
    ? `<div class="label">TOOLS</div><div class="chips">${agent.tools.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';
  const promptButton = agent.promptFile
    ? `<button onclick="openFile('${escapeAttr(agent.promptFile)}')">📂 Open Prompt</button>`
    : '';

  const body = `
  <div class="header-row">
    <h2>${escapeHtml(agent.name)}</h2>
    ${modeBadge}
  </div>
  <div class="path">${escapeHtml(agent.path)}</div>
  ${agent.description ? `<hr><div class="label">DESCRIPTION</div><div class="desc">${escapeHtml(agent.description)}</div>` : ''}
  ${metaRows}
  ${toolsChips}
  ${error}
  <hr>
  <div class="actions">
    <button onclick="openFile('${escapeAttr(agent.path)}')">📂 Open Source File</button>
    ${promptButton}
    <button onclick="copyPath('${escapeAttr(agent.path)}')">📋 Copy Path</button>
  </div>`;

  return `${htmlHead(webview, nonce)}${body}${htmlFooter(nonce)}`;
}
```

- [ ] **Step 2: Write `src/panel/renderers/mcp.ts`**

```typescript
import type * as vscode from 'vscode';
import { htmlHead, htmlFooter, escapeHtml, escapeAttr, badge, BADGE_OK, BADGE_ERROR, errorBlock } from '../html';
import type { McpServer } from '../../types';

export function renderMcp(webview: vscode.Webview, nonce: string, server: McpServer): string {
  const statusBadge = badge(server.enabled ? BADGE_OK : BADGE_ERROR, server.enabled ? 'enabled' : 'disabled');
  const error = server.error ? errorBlock('Error', server.error) : '';
  const transport = server.url
    ? `<div class="label">URL</div><code>${escapeHtml(server.url)}</code>`
    : server.command
      ? `<div class="label">COMMAND</div><code>${escapeHtml([server.command, ...(server.args ?? [])].join(' '))}</code>`
      : '';
  const copyUrlButton = server.url
    ? `<button onclick="copyPath('${escapeAttr(server.url)}')">📋 Copy URL</button>`
    : '';

  const body = `
  <div class="header-row">
    <h2>${escapeHtml(server.name)}</h2>
    <div class="header-badges">
      ${statusBadge}
      ${badge(BADGE_OK, server.type)}
    </div>
  </div>
  <div class="path">${escapeHtml(server.path)}</div>
  ${transport}
  ${error}
  <hr>
  <div class="actions">
    <button onclick="openFile('${escapeAttr(server.path)}')">📂 Open Config</button>
    ${copyUrlButton}
    <button onclick="copyPath('${escapeAttr(server.path)}')">📋 Copy Path</button>
  </div>`;

  return `${htmlHead(webview, nonce)}${body}${htmlFooter(nonce)}`;
}
```

- [ ] **Step 3: Write `src/panel/renderers/prompt.ts`**

```typescript
import type * as vscode from 'vscode';
import { htmlHead, htmlFooter, escapeHtml, escapeAttr, badge, BADGE_OK, errorBlock } from '../html';
import type { PromptItem } from '../../types';

export function renderPrompt(webview: vscode.Webview, nonce: string, item: PromptItem): string {
  const error = item.error ? errorBlock('Error', item.error) : '';
  const preview = item.error ? '' : `<div class="label">PREVIEW</div><pre>${escapeHtml(item.preview)}</pre>`;

  const body = `
  <div class="header-row">
    <h2>${escapeHtml(item.name)}</h2>
    <div class="header-badges">
      ${badge(BADGE_OK, item.kind)}
      ${badge(BADGE_OK, item.source)}
    </div>
  </div>
  <div class="path">${escapeHtml(item.path)}</div>
  ${error}
  ${preview}
  <hr>
  <div class="actions">
    <button onclick="openFile('${escapeAttr(item.path)}')">📂 Open File</button>
    <button onclick="copyPath('${escapeAttr(item.path)}')">📋 Copy Path</button>
  </div>`;

  return `${htmlHead(webview, nonce)}${body}${htmlFooter(nonce)}`;
}
```

- [ ] **Step 4: Run compile to verify everything resolves**

Run: `npx tsc --noEmit`
Expected: PASS (DetailPanel from Task 7 now compiles with all renderers present).

Run: `npx tsc -p tsconfig.test.json`
Expected: PASS.

Run: `npm run lint`
Expected: PASS (only the pre-existing `no-console` warning).

- [ ] **Step 5: Commit (part b of Task 7 + Task 8)**

```bash
git add src/panel/DetailPanel.ts src/panel/renderers/agent.ts src/panel/renderers/mcp.ts src/panel/renderers/prompt.ts
git commit -m "refactor: route detail panel through per-type renderers"
```

---

### Task 9: Extension wiring + package.json

**Files:**
- Modify: `src/extension.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `createSkillsView`, `createCommandsView`, `createAgentsView`, `createMcpView`, `createPromptsView` from `./tree/*`; `SkillsScanner`, `CommandsScanner`, `AgentsScanner`, `McpScanner`, `PromptsScanner` from `./scanner/*`; `DetailPanel` from `./panel/DetailPanel`; `ContentNode` from `./tree/content`; `DetailItem` from `./types`.
- Produces: three new registered tree views (`ho-opencode-agents`, `ho-opencode-mcp`, `ho-opencode-prompts`), generic selection routing, refresh functions for each scanner with independent debounce timers, extended file watchers.

- [ ] **Step 1: Update imports in `src/extension.ts`**

Replace the current tree/scanner imports with:

```typescript
import { SkillsScanner } from './scanner/SkillsScanner';
import { CommandsScanner } from './scanner/CommandsScanner';
import { AgentsScanner } from './scanner/AgentsScanner';
import { McpScanner } from './scanner/McpScanner';
import { PromptsScanner } from './scanner/PromptsScanner';
import { createSkillsView } from './tree/skills';
import { createCommandsView } from './tree/commands';
import { createAgentsView } from './tree/agents';
import { createMcpView } from './tree/mcp';
import { createPromptsView } from './tree/prompts';
import type { ContentNode } from './tree/content';
import { DetailPanel } from './panel/DetailPanel';
import { SkillToggleManager } from './toggle/SkillToggleManager';
import { UpdateService } from './update/UpdateService';
import type { DetailItem } from './types';
```

- [ ] **Step 2: Update module-level state**

Replace lines 10-19 with:

```typescript
let scanner: SkillsScanner;
let commandsScanner: CommandsScanner;
let agentsScanner: AgentsScanner;
let mcpScanner: McpScanner;
let promptsScanner: PromptsScanner;
let skillsView: ReturnType<typeof createSkillsView>;
let commandsView: ReturnType<typeof createCommandsView>;
let agentsView: ReturnType<typeof createAgentsView>;
let mcpView: ReturnType<typeof createMcpView>;
let promptsView: ReturnType<typeof createPromptsView>;
let detailPanel: DetailPanel;
let toggleManager: SkillToggleManager;
let updateService: UpdateService;
let skillsDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let commandsDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let agentsDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let mcpDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let promptsDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let extensionVersion = '0.0.0';
```

- [ ] **Step 3: Instantiate in `activate`**

Replace the constructor block (lines 22-28) with:

```typescript
  scanner = new SkillsScanner();
  commandsScanner = new CommandsScanner();
  agentsScanner = new AgentsScanner();
  mcpScanner = new McpScanner();
  promptsScanner = new PromptsScanner();
  skillsView = createSkillsView();
  commandsView = createCommandsView();
  agentsView = createAgentsView();
  mcpView = createMcpView();
  promptsView = createPromptsView();
  toggleManager = new SkillToggleManager();
  updateService = new UpdateService();
  detailPanel = new DetailPanel();
```

- [ ] **Step 4: Create the five tree views**

Replace the two `createTreeView` blocks (lines 30-42) with five:

```typescript
  // Skills TreeView
  const skillsTreeView = vscode.window.createTreeView('ho-opencode-skills', {
    treeDataProvider: skillsView.provider,
    canSelectMany: false,
  });
  context.subscriptions.push(skillsTreeView);

  // Commands TreeView
  const commandsTreeView = vscode.window.createTreeView('ho-opencode-commands', {
    treeDataProvider: commandsView.provider,
    canSelectMany: false,
  });
  context.subscriptions.push(commandsTreeView);

  // Agents TreeView
  const agentsTreeView = vscode.window.createTreeView('ho-opencode-agents', {
    treeDataProvider: agentsView.provider,
    canSelectMany: false,
  });
  context.subscriptions.push(agentsTreeView);

  // MCP TreeView
  const mcpTreeView = vscode.window.createTreeView('ho-opencode-mcp', {
    treeDataProvider: mcpView.provider,
    canSelectMany: false,
  });
  context.subscriptions.push(mcpTreeView);

  // Prompts TreeView
  const promptsTreeView = vscode.window.createTreeView('ho-opencode-prompts', {
    treeDataProvider: promptsView.provider,
    canSelectMany: false,
  });
  context.subscriptions.push(promptsTreeView);
```

- [ ] **Step 5: Generic selection routing**

Replace the two selection handler blocks (lines 52-74) with:

```typescript
  // Selection → detail panel (generic across all five views)
  context.subscriptions.push(
    onSelection(skillsTreeView),
    onSelection(commandsTreeView),
    onSelection(agentsTreeView),
    onSelection(mcpTreeView),
    onSelection(promptsTreeView),
  );
```

Add this helper function below `activate` (before `setupFileWatchers`):

```typescript
function onSelection<T extends DetailItem>(
  treeView: vscode.TreeView<ContentNode<T>>,
): vscode.Disposable {
  return treeView.onDidChangeSelection((event) => {
    const node = event.selection[0];
    if (node && node.type === 'item') {
      detailPanel.show(node.item);
    } else {
      detailPanel.clear();
    }
  });
}
```

- [ ] **Step 6: Register open-file commands for the new types**

After the `openCommandCommand` registration (after line 139), add:

```typescript
  // Open Agent Source command
  const openAgentCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.openAgent#sideBar',
    (agentPath: string) => {
      const uri = vscode.Uri.file(agentPath);
      vscode.commands.executeCommand('vscode.open', uri);
    },
  );
  context.subscriptions.push(openAgentCommand);

  // Open MCP Config command
  const openMcpCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.openMcp#sideBar',
    (mcpPath: string) => {
      const uri = vscode.Uri.file(mcpPath);
      vscode.commands.executeCommand('vscode.open', uri);
    },
  );
  context.subscriptions.push(openMcpCommand);

  // Open Prompt command
  const openPromptCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.openPrompt#sideBar',
    (promptPath: string) => {
      const uri = vscode.Uri.file(promptPath);
      vscode.commands.executeCommand('vscode.open', uri);
    },
  );
  context.subscriptions.push(openPromptCommand);
```

- [ ] **Step 7: Initial refresh calls**

Replace the `refreshSkills(); refreshCommands();` tail of `activate` (lines 147-148) with:

```typescript
  refreshSkills();
  refreshCommands();
  refreshAgents();
  refreshMcp();
  refreshPrompts();
```

- [ ] **Step 8: Add the three refresh functions + debounce timers**

After `debouncedRefreshCommands` (line 229), add:

```typescript
function debouncedRefreshAgents(): void {
  if (agentsDebounceTimer) clearTimeout(agentsDebounceTimer);
  agentsDebounceTimer = setTimeout(() => refreshAgents(), 500);
}

function debouncedRefreshMcp(): void {
  if (mcpDebounceTimer) clearTimeout(mcpDebounceTimer);
  mcpDebounceTimer = setTimeout(() => refreshMcp(), 500);
}

function debouncedRefreshPrompts(): void {
  if (promptsDebounceTimer) clearTimeout(promptsDebounceTimer);
  promptsDebounceTimer = setTimeout(() => refreshPrompts(), 500);
}
```

Replace the existing `refreshSkills`/`refreshCommands` bodies to use the view factories:

```typescript
async function refreshSkills(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

  const { global, local } = await scanner.scanAll(workspaceRoot);
  skillsView.setData(global, local);
  updateViewTitle();
}

async function refreshCommands(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

  const groups = await commandsScanner.scanAll(workspaceRoot);
  commandsView.setData(groups);
}

async function refreshAgents(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

  const result = await agentsScanner.scanAll(workspaceRoot);
  agentsView.setData(result.config, result.global, result.local);
}

async function refreshMcp(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

  const result = await mcpScanner.scanAll(workspaceRoot);
  mcpView.setData(result.global, result.project);
}

async function refreshPrompts(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

  const result = await promptsScanner.scanAll(workspaceRoot);
  promptsView.setData(result.global, result.local);
}
```

- [ ] **Step 9: Extend `setupFileWatchers`**

Inside `setupFileWatchers`, after the existing local commands watcher (after line 218), add:

```typescript
  // Agents watchers
  const agentsGlobalPattern = new vscode.RelativePattern(
    vscode.Uri.file(home),
    '.config/opencode/agent/**/*.md',
  );
  const agentsGlobalWatcher = vscode.workspace.createFileSystemWatcher(agentsGlobalPattern);
  agentsGlobalWatcher.onDidChange(debouncedRefreshAgents);
  agentsGlobalWatcher.onDidCreate(debouncedRefreshAgents);
  agentsGlobalWatcher.onDidDelete(debouncedRefreshAgents);
  context.subscriptions.push(agentsGlobalWatcher);

  if (workspaceFolders && workspaceFolders.length > 0) {
    const agentsLocalPattern = new vscode.RelativePattern(
      workspaceFolders[0]!,
      '.opencode/agent/**/*.md',
    );
    const agentsLocalWatcher = vscode.workspace.createFileSystemWatcher(agentsLocalPattern);
    agentsLocalWatcher.onDidChange(debouncedRefreshAgents);
    agentsLocalWatcher.onDidCreate(debouncedRefreshAgents);
    agentsLocalWatcher.onDidDelete(debouncedRefreshAgents);
    context.subscriptions.push(agentsLocalWatcher);
  }

  // MCP project watcher
  if (workspaceFolders && workspaceFolders.length > 0) {
    const mcpPattern = new vscode.RelativePattern(workspaceFolders[0]!, '.mcp.json');
    const mcpWatcher = vscode.workspace.createFileSystemWatcher(mcpPattern);
    mcpWatcher.onDidChange(debouncedRefreshMcp);
    mcpWatcher.onDidCreate(debouncedRefreshMcp);
    mcpWatcher.onDidDelete(debouncedRefreshMcp);
    context.subscriptions.push(mcpWatcher);
  }

  // Prompts watchers
  const promptsGlobalPattern = new vscode.RelativePattern(
    vscode.Uri.file(home),
    '.config/opencode/prompts/**/*.{txt,md}',
  );
  const promptsGlobalWatcher = vscode.workspace.createFileSystemWatcher(promptsGlobalPattern);
  promptsGlobalWatcher.onDidChange(debouncedRefreshPrompts);
  promptsGlobalWatcher.onDidCreate(debouncedRefreshPrompts);
  promptsGlobalWatcher.onDidDelete(debouncedRefreshPrompts);
  context.subscriptions.push(promptsGlobalWatcher);

  if (workspaceFolders && workspaceFolders.length > 0) {
    const promptsLocalPattern = new vscode.RelativePattern(
      workspaceFolders[0]!,
      '.opencode/prompt/**/*.{txt,md}',
    );
    const promptsLocalWatcher = vscode.workspace.createFileSystemWatcher(promptsLocalPattern);
    promptsLocalWatcher.onDidChange(debouncedRefreshPrompts);
    promptsLocalWatcher.onDidCreate(debouncedRefreshPrompts);
    promptsLocalWatcher.onDidDelete(debouncedRefreshPrompts);
    context.subscriptions.push(promptsLocalWatcher);

    const instructionsPattern = new vscode.RelativePattern(workspaceFolders[0]!, '{AGENTS.md,CLAUDE.md}');
    const instructionsWatcher = vscode.workspace.createFileSystemWatcher(instructionsPattern);
    instructionsWatcher.onDidChange(debouncedRefreshPrompts);
    instructionsWatcher.onDidCreate(debouncedRefreshPrompts);
    instructionsWatcher.onDidDelete(debouncedRefreshPrompts);
    context.subscriptions.push(instructionsWatcher);
  }
```

Then update the existing `opencode.json` config watcher (lines 192-206) to also refresh agents, mcp, and prompts:

```typescript
  const configWatcher = vscode.workspace.createFileSystemWatcher(configPattern);
  configWatcher.onDidChange(() => {
    debouncedRefreshSkills();
    debouncedRefreshCommands();
    debouncedRefreshAgents();
    debouncedRefreshMcp();
    debouncedRefreshPrompts();
  });
  configWatcher.onDidCreate(() => {
    debouncedRefreshSkills();
    debouncedRefreshCommands();
    debouncedRefreshAgents();
    debouncedRefreshMcp();
    debouncedRefreshPrompts();
  });
  context.subscriptions.push(configWatcher);
```

- [ ] **Step 10: Update `deactivate`**

Extend the existing cleanup to clear the three new timers:

```typescript
export function deactivate(): void {
  for (const timer of [
    skillsDebounceTimer,
    commandsDebounceTimer,
    agentsDebounceTimer,
    mcpDebounceTimer,
    promptsDebounceTimer,
  ]) {
    if (timer) clearTimeout(timer);
  }
  skillsDebounceTimer = undefined;
  commandsDebounceTimer = undefined;
  agentsDebounceTimer = undefined;
  mcpDebounceTimer = undefined;
  promptsDebounceTimer = undefined;
}
```

- [ ] **Step 11: Update `package.json` — views**

In `contributes.views."ho-opencode-explorer"`, add three entries after the `ho-opencode-commands` entry:

```json
{
  "id": "ho-opencode-agents",
  "name": "Agents"
},
{
  "id": "ho-opencode-mcp",
  "name": "MCP Servers"
},
{
  "id": "ho-opencode-prompts",
  "name": "Prompts & Instructions"
}
```

- [ ] **Step 12: Update `package.json` — commands + menus**

Add to `contributes.commands`:

```json
{
  "command": "_ho-opencode-explorer.openAgent#sideBar",
  "title": "Open Agent Source",
  "category": "HO OpenCode Explorer",
  "icon": "$(go-to-file)"
},
{
  "command": "_ho-opencode-explorer.openMcp#sideBar",
  "title": "Open MCP Config",
  "category": "HO OpenCode Explorer",
  "icon": "$(go-to-file)"
},
{
  "command": "_ho-opencode-explorer.openPrompt#sideBar",
  "title": "Open Prompt File",
  "category": "HO OpenCode Explorer",
  "icon": "$(go-to-file)"
}
```

Add to `contributes.menus."view/item/context"`:

```json
{
  "command": "_ho-opencode-explorer.openAgent#sideBar",
  "when": "view == ho-opencode-agents && viewItem == agent",
  "group": "inline"
},
{
  "command": "_ho-opencode-explorer.openMcp#sideBar",
  "when": "view == ho-opencode-mcp && viewItem == mcp",
  "group": "inline"
},
{
  "command": "_ho-opencode-explorer.openPrompt#sideBar",
  "when": "view == ho-opencode-prompts && viewItem == prompt",
  "group": "inline"
}
```

- [ ] **Step 13: Verify build**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm run lint`
Expected: PASS.

Run: `npm run package`
Expected: build succeeds.

- [ ] **Step 14: Commit**

```bash
git add src/extension.ts package.json
git commit -m "feat: wire agents, mcp and prompts views into extension"
```

---

### Task 10: Full verification and package

**Files:**
- None (verification only).

**Interfaces:**
- Consumes: all tasks above.

- [ ] **Step 1: Compile tests**

Run: `npx tsc -p tsconfig.test.json`
Expected: PASS.

- [ ] **Step 2: Source typecheck + lint + build**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm run lint`
Expected: PASS (single pre-existing warning).

Run: `npm run package`
Expected: PASS — `dist/extension.js` emitted.

- [ ] **Step 3: Run the integration test suite**

Run: `npm test`
Expected: all suites pass (SkillsScanner, frontmatter, CommandsScanner, AgentsScanner, McpScanner, PromptsScanner, skills view, commands view, agents view, mcp view, prompts view, toggle, update). Note: the first run downloads the VS Code test build if not cached.

If a specific suite fails, fix the failing implementation and re-run until green.

- [ ] **Step 4: Package and inspect the VSIX**

Run: `npx @vscode/vsce package --out /tmp/ho-content-check.vsix`
Expected: package succeeds; contents include `dist/extension.js`, `resources/icon.png`, `package.json`, docs. No `out/`, no `src/`, no `*.map`.

- [ ] **Step 5: Manual smoke test**

Launch the extension host (F5 in VS Code). Verify:
- Three new views appear under the HO OpenCode Explorer container.
- Agents view lists config agents and any `.md` agents.
- MCP view lists servers with enabled/disabled descriptions.
- Prompts & Instructions view lists prompt files and AGENTS.md/CLAUDE.md.
- Selecting any item renders its detail panel; Open/Copy buttons work.
- Checkboxes on Skills still toggle frontmatter.

- [ ] **Step 6: Final commit if any fixes were applied**

```bash
git add -A
git commit -m "fix: address verification findings"
```

---

## Self-Review Notes

- **Spec coverage:** Feature 1 (Agents) → Tasks 2, 6, 8, 9. Feature 2 (MCP) → Tasks 3, 6, 8, 9. Feature 3 (Prompts & Instructions) → Tasks 4, 6, 8, 9. Generic provider + migration → Tasks 1, 5. DetailPanel refactor → Tasks 7, 8. Extension wiring + package.json → Task 9. Verification → Task 10. All spec sections mapped.
- **Placeholders:** No TBD/TODO. All code blocks are complete implementations.
- **Type consistency:** `itemType` literals used throughout; `ContentNode<T>`/`ContentItemNode<T>`/`ContentCategory<T>` consistent across Tasks 5-6 and the `onSelection` helper; `DetailItem` union drives `DetailPanel.show` dispatch; scanner constructor override shapes match their test usages.
