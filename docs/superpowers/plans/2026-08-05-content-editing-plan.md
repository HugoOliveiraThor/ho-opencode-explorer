# Content Creation & Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add content creation (skills/commands), inline skill editing, and move-between-sources to the HO OpenCode Explorer.

**Architecture:** Three plain-TypeScript modules (`ContentCreator`, `SkillEditor`, `ContentMover`) with injectable path roots, sharing a `safePaths` validation util. Native VS Code dialogs drive create/move; the existing detail-panel webview hosts the edit form with strict CSP/nonce and validated `editSkill` messages.

**Tech Stack:** TypeScript (Node16 modules), VS Code API, esbuild, `@vscode/test-cli` + Mocha, `yaml`, Node `fs`.

## Global Constraints

- VS Code engine floor: `^1.85.0`; strict mode: `strict: true`, `noUncheckedIndexedAccess: true`.
- Command IDs follow the sidebar convention: `_ho-opencode-explorer.<name>#sideBar`; every command defines `title`, `category`, `icon`.
- WebView HTML keeps the strict CSP (`default-src 'none'; script-src 'nonce-…'`); every interpolated value is escaped via `escapeHtml` (text) or `escapeAttr` (attributes).
- WebView messages are validated before acting; new `editSkill` message requires `path: string`, `name: string`, `description: string`, `enabled: boolean`.
- All file operations go through `safePaths`; no write escapes the configured roots.
- Modules accept constructor path overrides (same pattern as the scanners) so tests use temp directories.
- Tests live in `src/test/suite/*.test.ts`; they reference fixtures via `path.resolve(__dirname, '..', '..', '..', 'src', 'test', ...)` and may create temp dirs under `os.tmpdir()`.
- Commit messages follow Conventional Commits; pre-commit lint must pass.

---

### Task 1: `safePaths` util + tests

**Files:**
- Create: `src/util/safePaths.ts`
- Test: `src/test/suite/safePaths.test.ts`

**Interfaces:**
- Consumes: nothing (Node `path`).
- Produces: `assertSafeName(name: string): string` (throws on empty, `.`/`..`, path separators, control chars; returns kebab-case), `toKebabCase(input: string): string`, `resolveWithin(base: string, relative: string): string | null`.

- [ ] **Step 1: Write the failing test**

`src/test/suite/safePaths.test.ts`:
```typescript
import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import { assertSafeName, toKebabCase, resolveWithin } from '../../util/safePaths';

suite('safePaths', () => {
  test('assertSafeName kebab-cases a valid name', () => {
    assert.strictEqual(assertSafeName('My Skill'), 'my-skill');
  });

  test('assertSafeName rejects empty names', () => {
    assert.throws(() => assertSafeName('   '));
  });

  test('assertSafeName rejects dots', () => {
    assert.throws(() => assertSafeName('..'));
    assert.throws(() => assertSafeName('.'));
  });

  test('assertSafeName rejects path separators', () => {
    assert.throws(() => assertSafeName('a/b'));
    assert.throws(() => assertSafeName('a\\b'));
  });

  test('toKebabCase handles mixed input', () => {
    assert.strictEqual(toKebabCase('  Hello World!  '), 'hello-world');
  });

  test('resolveWithin resolves valid relative paths', () => {
    const base = os.tmpdir();
    const resolved = resolveWithin(base, 'sub/file');
    assert.ok(resolved);
    assert.strictEqual(resolved, path.resolve(base, 'sub/file'));
  });

  test('resolveWithin returns null on traversal', () => {
    const base = path.join(os.tmpdir(), 'safe-root');
    assert.strictEqual(resolveWithin(base, '../escape'), null);
    assert.strictEqual(resolveWithin(base, '/absolute'), null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsc -p tsconfig.test.json`
Expected: FAIL — module `../../util/safePaths` not found.

- [ ] **Step 3: Write `src/util/safePaths.ts`**

```typescript
import * as path from 'path';

export function toKebabCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function assertSafeName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error('Name cannot be empty');
  if (trimmed === '.' || trimmed === '..') throw new Error('Invalid name');
  if (/[/\\]/.test(trimmed)) throw new Error('Name cannot contain path separators');
  if (/[\u0000-\u001f]/.test(trimmed)) throw new Error('Name contains control characters');
  const kebab = toKebabCase(trimmed);
  if (kebab.length === 0) throw new Error('Name must contain at least one letter or digit');
  return kebab;
}

export function resolveWithin(base: string, relative: string): string | null {
  const resolvedBase = path.resolve(base);
  const resolved = path.resolve(resolvedBase, relative);
  if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + path.sep)) {
    return null;
  }
  return resolved;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsc -p tsconfig.test.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/util/safePaths.ts src/test/suite/safePaths.test.ts
git commit -m "feat: add safe paths validation util"
```

---

### Task 2: `ContentCreator` + tests

**Files:**
- Create: `src/create/ContentCreator.ts`
- Test: `src/test/suite/contentCreator.test.ts`

**Interfaces:**
- Consumes: `assertSafeName`, `resolveWithin` from `../util/safePaths`; `vscode`; Node `fs`/`path`.
- Produces: `class ContentCreator` with constructor `constructor(overrides: Partial<{ globalSkillsDir: string; localSkillsDir: string; globalCommandsDir: string; localCommandsDir: string }> = {})`. Testable methods: `scaffoldSkill(dirPath: string, rawName: string): string` (returns created file path), `scaffoldCommand(dirPath: string, rawName: string): string`. UI flow methods: `createSkill(workspaceRoot?: string): Promise<void>`, `createCommand(workspaceRoot?: string): Promise<void>`.

- [ ] **Step 1: Write the failing test**

`src/test/suite/contentCreator.test.ts`:
```typescript
import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ContentCreator } from '../../create/ContentCreator';

suite('ContentCreator', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-'));
  const creator = new ContentCreator({
    globalSkillsDir: path.join(tmp, 'skills'),
    localSkillsDir: 'skills',
    globalCommandsDir: path.join(tmp, 'commands'),
    localCommandsDir: 'commands',
  });

  test('scaffolds a skill directory with frontmatter', () => {
    const filePath = creator.scaffoldSkill(path.join(tmp, 'skills'), 'My Skill');
    assert.ok(fs.existsSync(filePath));
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('name: my-skill'));
    assert.ok(content.includes('enabled: true'));
    assert.ok(content.includes('description: ""'));
  });

  test('rejects duplicate skill names', () => {
    assert.throws(() => creator.scaffoldSkill(path.join(tmp, 'skills'), 'My Skill'));
  });

  test('rejects invalid skill names', () => {
    assert.throws(() => creator.scaffoldSkill(path.join(tmp, 'skills'), 'a/b'));
    assert.throws(() => creator.scaffoldSkill(path.join(tmp, 'skills'), ''));
  });

  test('scaffolds a command file', () => {
    const filePath = creator.scaffoldCommand(path.join(tmp, 'commands'), 'My Command');
    assert.ok(fs.existsSync(filePath));
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('description: ""'));
    assert.ok(path.basename(filePath), 'my-command.md');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsc -p tsconfig.test.json`
Expected: FAIL — module `../../create/ContentCreator` not found.

- [ ] **Step 3: Write `src/create/ContentCreator.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { assertSafeName, resolveWithin } from '../util/safePaths';

interface ContentCreatorRoots {
  globalSkillsDir: string;
  localSkillsDir: string;
  globalCommandsDir: string;
  localCommandsDir: string;
}

const SKILL_TEMPLATE = (name: string): string =>
  `---\nname: ${name}\ndescription: ""\nenabled: true\n---\n\n# ${name}\n\nDescribe what this skill does.\n`;

const COMMAND_TEMPLATE =
  '---\ndescription: ""\n---\n\nDescribe what this command does.\n';

export class ContentCreator {
  private readonly globalSkillsDir: string;
  private readonly localSkillsDir: string;
  private readonly globalCommandsDir: string;
  private readonly localCommandsDir: string;

  constructor(overrides: Partial<ContentCreatorRoots> = {}) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    this.globalSkillsDir =
      overrides.globalSkillsDir ?? path.join(home, '.config', 'opencode', 'skills');
    this.localSkillsDir = overrides.localSkillsDir ?? '.opencode/skills';
    this.globalCommandsDir =
      overrides.globalCommandsDir ?? path.join(home, '.config', 'opencode', 'commands');
    this.localCommandsDir = overrides.localCommandsDir ?? '.opencode/commands';
  }

  scaffoldSkill(dirPath: string, rawName: string): string {
    const name = assertSafeName(rawName);
    const skillDir = resolveWithin(dirPath, name);
    if (!skillDir) throw new Error('Invalid destination path');
    if (fs.existsSync(skillDir)) throw new Error(`A skill named "${name}" already exists`);
    const filePath = path.join(skillDir, 'SKILL.md');
    fs.mkdirSync(skillDir, { recursive: true });
    try {
      fs.writeFileSync(filePath, SKILL_TEMPLATE(name), 'utf-8');
    } catch (err) {
      if (fs.existsSync(skillDir)) fs.rmSync(skillDir, { recursive: true, force: true });
      throw err;
    }
    return filePath;
  }

  scaffoldCommand(dirPath: string, rawName: string): string {
    const name = assertSafeName(rawName);
    const filePath = resolveWithin(dirPath, `${name}.md`);
    if (!filePath) throw new Error('Invalid destination path');
    if (fs.existsSync(filePath)) throw new Error(`A command named "${name}" already exists`);
    fs.writeFileSync(filePath, COMMAND_TEMPLATE, 'utf-8');
    return filePath;
  }

  async createSkill(workspaceRoot?: string): Promise<void> {
    const destination = await this.pickDestination(workspaceRoot);
    const name = await this.pickName('Skill name');
    const dir =
      destination === 'global'
        ? this.globalSkillsDir
        : path.join(workspaceRoot!, this.localSkillsDir);
    this.scaffoldSkill(dir, name);
  }

  async createCommand(workspaceRoot?: string): Promise<void> {
    const destination = await this.pickDestination(workspaceRoot);
    const name = await this.pickName('Command name');
    const dir =
      destination === 'global'
        ? this.globalCommandsDir
        : path.join(workspaceRoot!, this.localCommandsDir);
    this.scaffoldCommand(dir, name);
  }

  private async pickDestination(workspaceRoot?: string): Promise<'global' | 'local'> {
    const items: vscode.QuickPickItem[] = [
      { label: 'Global', detail: '~/.config/opencode' },
    ];
    const hasWorkspace = Boolean(workspaceRoot);
    items.push({
      label: 'Local',
      detail: hasWorkspace ? 'Current workspace .opencode' : 'Requires an open workspace folder',
      description: hasWorkspace ? undefined : '(unavailable)',
    });
    const pick = await vscode.window.showQuickPick(items, { placeHolder: 'Where should this be created?' });
    if (!pick) throw new Error('Creation cancelled');
    if (pick.label === 'Local' && !hasWorkspace) throw new Error('Local creation requires an open workspace folder');
    return pick.label === 'Global' ? 'global' : 'local';
  }

  private async pickName(prompt: string): Promise<string> {
    const name = await vscode.window.showInputBox({
      prompt,
      validateInput: (value) => {
        try {
          assertSafeName(value);
          return undefined;
        } catch (err) {
          return err instanceof Error ? err.message : 'Invalid name';
        }
      },
    });
    if (name === undefined) throw new Error('Creation cancelled');
    return name;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsc -p tsconfig.test.json`
Expected: PASS. Adjust the `description: "{}"` assertion to the actual YAML output if it differs.

- [ ] **Step 5: Commit**

```bash
git add src/create/ContentCreator.ts src/test/suite/contentCreator.test.ts
git commit -m "feat: add content creator for skills and commands"
```

---

### Task 3: `SkillEditor` + tests

**Files:**
- Create: `src/edit/SkillEditor.ts`
- Test: `src/test/suite/skillEditor.test.ts`

**Interfaces:**
- Consumes: `extractFrontmatter`, `extractBody` from `../scanner/frontmatter` (`.js` suffix per scanner convention); `yaml`; Node `fs`/`path`.
- Produces: `class SkillEditor` with `editSkill(filePath: string, changes: { name: string; description: string; enabled: boolean }): void`.

- [ ] **Step 1: Write the failing test**

`src/test/suite/skillEditor.test.ts`:
```typescript
import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SkillEditor } from '../../edit/SkillEditor.js';

suite('SkillEditor', () => {
  const editor = new SkillEditor();

  function writeSkill(frontmatter: string, body: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'editor-'));
    const file = path.join(dir, 'SKILL.md');
    fs.writeFileSync(file, `---\n${frontmatter}\n---\n${body}`, 'utf-8');
    return file;
  }

  test('updates all three fields preserving body', () => {
    const file = writeSkill('name: old\ndescription: desc\nenabled: true\n', '\n# Old\n\nBody text.');
    editor.editSkill(file, { name: 'new-name', description: 'New desc', enabled: false });
    const content = fs.readFileSync(file, 'utf-8');
    assert.ok(content.includes('name: new-name'));
    assert.ok(content.includes('description: New desc'));
    assert.ok(content.includes('enabled: false'));
    assert.ok(content.includes('# Old\n\nBody text.'));
  });

  test('creates frontmatter when absent', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'editor-'));
    const file = path.join(dir, 'SKILL.md');
    fs.writeFileSync(file, 'Just a body.', 'utf-8');
    editor.editSkill(file, { name: 'x', description: 'd', enabled: true });
    const content = fs.readFileSync(file, 'utf-8');
    assert.ok(content.startsWith('---'));
    assert.ok(content.includes('name: x'));
  });

  test('throws on invalid YAML frontmatter', () => {
    const file = writeSkill('description: [unclosed\n', '\nBody.');
    assert.throws(() => editor.editSkill(file, { name: 'x', description: 'd', enabled: true }));
    // original untouched
    assert.ok(fs.readFileSync(file, 'utf-8').includes('[unclosed'));
  });

  test('writes atomically (temp file does not remain)', () => {
    const file = writeSkill('name: a\n', '\nBody.');
    editor.editSkill(file, { name: 'b', description: 'c', enabled: true });
    const dir = path.dirname(file);
    const leftovers = fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'));
    assert.deepStrictEqual(leftovers, []);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsc -p tsconfig.test.json`
Expected: FAIL — module `../../edit/SkillEditor.js` not found.

- [ ] **Step 3: Write `src/edit/SkillEditor.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { extractFrontmatter, extractBody } from '../scanner/frontmatter.js';

export interface SkillChanges {
  name: string;
  description: string;
  enabled: boolean;
}

export class SkillEditor {
  editSkill(filePath: string, changes: SkillChanges): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const frontmatter = extractFrontmatter(content);
    const body = frontmatter ? extractBody(content) : content;

    let merged: Record<string, unknown>;
    if (frontmatter) {
      const parsed = YAML.parse(frontmatter) as Record<string, unknown>;
      merged = { ...parsed, ...changes };
    } else {
      merged = { ...changes };
    }

    const serialized = YAML.stringify(merged).trimEnd();
    const newContent = `---\n${serialized}\n---` + (body ? `\n\n${body}` : '') + '\n';
    this.writeAtomic(filePath, newContent);
  }

  private writeAtomic(filePath: string, content: string): void {
    const dir = path.dirname(filePath);
    const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
    fs.writeFileSync(tmpPath, content, 'utf-8');
    fs.renameSync(tmpPath, filePath);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsc -p tsconfig.test.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/edit/SkillEditor.ts src/test/suite/skillEditor.test.ts
git commit -m "feat: add skill editor with atomic writes"
```

---

### Task 4: `ContentMover` + tests

**Files:**
- Create: `src/move/ContentMover.ts`
- Test: `src/test/suite/contentMover.test.ts`

**Interfaces:**
- Consumes: Node `fs`/`path`.
- Produces: `class ContentMover` with constructor `constructor(overrides: Partial<{ globalSkillsDir: string; localSkillsDir: string; globalCommandsDir: string; localCommandsDir: string }> = {})`. Methods `moveSkill(filePath: string, source: 'global' | 'local', workspaceRoot?: string): string` and `moveCommand(filePath: string, source: 'global' | 'local', workspaceRoot?: string): string`, both returning the destination path.

- [ ] **Step 1: Write the failing test**

`src/test/suite/contentMover.test.ts`:
```typescript
import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ContentMover } from '../../move/ContentMover';

suite('ContentMover', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mover-'));
  const ws = path.join(tmp, 'workspace');
  const globalSkills = path.join(tmp, 'global-skills');
  const localSkills = path.join(tmp, 'local-skills');
  const globalCommands = path.join(tmp, 'global-commands');
  const localCommands = path.join(tmp, 'local-commands');
  const mover = new ContentMover({
    globalSkillsDir: globalSkills,
    localSkillsDir: localSkills,
    globalCommandsDir: globalCommands,
    localCommandsDir: localCommands,
  });

  test('moves a skill directory from global to local', () => {
    fs.mkdirSync(path.join(globalSkills, 'alpha', 'SKILL.md'), { recursive: true });
    const from = path.join(globalSkills, 'alpha');
    const dest = mover.moveSkill(from, 'global', ws);
    assert.strictEqual(dest, path.join(localSkills, 'alpha'));
    assert.ok(fs.existsSync(path.join(localSkills, 'alpha', 'SKILL.md')));
    assert.ok(!fs.existsSync(from));
  });

  test('moves a skill from local to global', () => {
    fs.mkdirSync(path.join(localSkills, 'beta', 'SKILL.md'), { recursive: true });
    const from = path.join(localSkills, 'beta');
    const dest = mover.moveSkill(from, 'local', ws);
    assert.strictEqual(dest, path.join(globalSkills, 'beta'));
    assert.ok(fs.existsSync(path.join(globalSkills, 'beta', 'SKILL.md')));
  });

  test('moves a command file', () => {
    fs.writeFileSync(path.join(globalCommands, 'gamma.md'), '---\ndescription: x\n---\n', 'utf-8');
    const from = path.join(globalCommands, 'gamma.md');
    const dest = mover.moveCommand(from, 'global', ws);
    assert.strictEqual(dest, path.join(localCommands, 'gamma.md'));
    assert.ok(fs.existsSync(path.join(localCommands, 'gamma.md')));
  });

  test('rejects when target already exists', () => {
    fs.mkdirSync(path.join(globalSkills, 'dup'), { recursive: true });
    fs.mkdirSync(path.join(localSkills, 'dup'), { recursive: true });
    assert.throws(() => mover.moveSkill(path.join(globalSkills, 'dup'), 'global', ws));
  });

  test('throws when local target has no workspace', () => {
    assert.throws(() => mover.moveSkill(path.join(globalSkills, 'alpha'), 'global', undefined));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsc -p tsconfig.test.json`
Expected: FAIL — module `../../move/ContentMover` not found.

- [ ] **Step 3: Write `src/move/ContentMover.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';

interface ContentMoverRoots {
  globalSkillsDir: string;
  localSkillsDir: string;
  globalCommandsDir: string;
  localCommandsDir: string;
}

export class ContentMover {
  private readonly globalSkillsDir: string;
  private readonly localSkillsDir: string;
  private readonly globalCommandsDir: string;
  private readonly localCommandsDir: string;

  constructor(overrides: Partial<ContentMoverRoots> = {}) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    this.globalSkillsDir =
      overrides.globalSkillsDir ?? path.join(home, '.config', 'opencode', 'skills');
    this.localSkillsDir = overrides.localSkillsDir ?? '.opencode/skills';
    this.globalCommandsDir =
      overrides.globalCommandsDir ?? path.join(home, '.config', 'opencode', 'commands');
    this.localCommandsDir = overrides.localCommandsDir ?? '.opencode/commands';
  }

  moveSkill(filePath: string, source: 'global' | 'local', workspaceRoot?: string): string {
    const dirName = path.basename(path.dirname(filePath));
    const target = this.targetDir(source, workspaceRoot, 'skills');
    const targetPath = path.join(target, dirName);
    if (fs.existsSync(targetPath)) {
      throw new Error(`A skill named "${dirName}" already exists at the destination`);
    }
    this.move(filePath, targetPath);
    return targetPath;
  }

  moveCommand(filePath: string, source: 'global' | 'local', workspaceRoot?: string): string {
    const fileName = path.basename(filePath);
    const target = this.targetDir(source, workspaceRoot, 'commands');
    const targetPath = path.join(target, fileName);
    if (fs.existsSync(targetPath)) {
      throw new Error(`A command named "${fileName}" already exists at the destination`);
    }
    this.move(filePath, targetPath);
    return targetPath;
  }

  private targetDir(
    source: 'global' | 'local',
    workspaceRoot: string | undefined,
    kind: 'skills' | 'commands',
  ): string {
    if (source === 'global') {
      if (!workspaceRoot) throw new Error('Local operations require an open workspace folder');
      const rel = kind === 'skills' ? this.localSkillsDir : this.localCommandsDir;
      return path.join(workspaceRoot, rel);
    }
    return kind === 'skills' ? this.globalSkillsDir : this.globalCommandsDir;
  }

  private move(from: string, to: string): void {
    try {
      fs.renameSync(from, to);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
        fs.cpSync(from, to, { recursive: true });
        fs.rmSync(from, { recursive: true, force: true });
      } else {
        throw err;
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsc -p tsconfig.test.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/move/ContentMover.ts src/test/suite/contentMover.test.ts
git commit -m "feat: add content mover between global and local"
```

---

### Task 5: Detail panel edit mode

**Files:**
- Modify: `src/panel/renderers/skill.ts`
- Modify: `src/panel/DetailPanel.ts`

**Interfaces:**
- Consumes: `escapeHtml`, `escapeAttr`, `htmlHead`, `htmlFooter` from `../html`; `Skill` from `../../types`; `SkillEditor` from `../../edit/SkillEditor`.
- Produces: `renderSkill(webview, nonce, skill)` now includes an edit mode; `DetailPanel` constructor becomes `constructor(options: { onSkillEdited?: (updated: Skill) => void } = {})` and handles the validated `editSkill` message.

- [ ] **Step 1: Add edit mode to `renderers/skill.ts`**

Replace the whole file body so the view content is wrapped and an edit form + toggle JS is added:

```typescript
import type * as vscode from 'vscode';
import {
  htmlHead,
  htmlFooter,
  escapeHtml,
  escapeAttr,
  badge,
  BADGE_OK,
  BADGE_ERROR,
  errorBlock,
} from '../html';
import type { Skill } from '../../types';

export function renderSkill(webview: vscode.Webview, nonce: string, skill: Skill): string {
  const warningIcon = skill.yamlError ? '⚠️ ' : '';
  const enabledBadge = badge(
    skill.enabled ? BADGE_OK : BADGE_ERROR,
    skill.enabled ? 'enabled' : 'disabled',
  );
  const error = skill.yamlError ? errorBlock('YAML Error', skill.yamlError) : '';
  const editButton = skill.yamlError
    ? ''
    : `<button onclick="enterEdit()">✏️ Edit</button>`;

  const body = `
  <div id="view-mode">
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
      ${editButton}
    </div>
  </div>
  <div id="edit-mode" style="display:none">
    <div class="label">NAME</div>
    <input id="edit-name" type="text" value="${escapeAttr(skill.name)}" style="width:100%;box-sizing:border-box;margin-bottom:8px;padding:4px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:2px;">
    <div class="label">DESCRIPTION</div>
    <textarea id="edit-desc" rows="4" style="width:100%;box-sizing:border-box;margin-bottom:8px;padding:4px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:2px;">${escapeHtml(skill.description)}</textarea>
    <div class="label">ENABLED</div>
    <input id="edit-enabled" type="checkbox" ${skill.enabled ? 'checked' : ''} style="margin-bottom:8px;">
    <div class="actions">
      <button onclick="saveEdit()">💾 Save</button>
      <button onclick="cancelEdit()">✖ Cancel</button>
    </div>
  </div>`;

  const script = `<script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function openFile(path) { vscode.postMessage({ command: 'openFile', path }); }
    function copyPath(path) { vscode.postMessage({ command: 'copyPath', path }); }
    function enterEdit() {
      document.getElementById('view-mode').style.display = 'none';
      document.getElementById('edit-mode').style.display = 'block';
    }
    function cancelEdit() {
      document.getElementById('edit-mode').style.display = 'none';
      document.getElementById('view-mode').style.display = 'block';
    }
    function saveEdit() {
      vscode.postMessage({
        command: 'editSkill',
        path: '${escapeAttr(skill.path)}',
        name: document.getElementById('edit-name').value,
        description: document.getElementById('edit-desc').value,
        enabled: document.getElementById('edit-enabled').checked
      });
    }
  </script>
</body>
</html>`;

  return `${htmlHead(webview, nonce)}${body}${script}`;
}
```

> Note: `htmlFooter(nonce)` is replaced by the custom `script` block because the edit form needs `saveEdit`. The `script` block is identical to `htmlFooter` except for the two extra functions; it still carries the `nonce` and the CSP remains unchanged.

- [ ] **Step 2: Extend `DetailPanel.ts` to handle `editSkill`**

Update the class:

```typescript
import * as vscode from 'vscode';
import { htmlHead, htmlFooter, getNonce } from './html';
import { renderSkill } from './renderers/skill';
import { renderCommand } from './renderers/command';
import { renderAgent } from './renderers/agent';
import { renderMcp } from './renderers/mcp';
import { renderPrompt } from './renderers/prompt';
import { SkillEditor } from '../edit/SkillEditor';
import type { DetailItem, Skill } from '../types';

export interface DetailPanelOptions {
  onSkillEdited?: (updated: Skill) => void;
}

export class DetailPanel implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private currentSkill?: Skill;
  private readonly editor = new SkillEditor();

  constructor(private readonly options: DetailPanelOptions = {}) {}

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
      } else if (this.isEditSkillMessage(message)) {
        this.handleEditSkill(message);
      }
    });
  }

  show(item: DetailItem): void {
    if (!this._view) return;
    this._view.show(true);
    if (item.itemType === 'skill') {
      this.currentSkill = item;
    }
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

  private isEditSkillMessage(message: unknown): message is {
    command: string;
    path: string;
    name: string;
    description: string;
    enabled: boolean;
  } {
    if (!message || typeof message !== 'object') return false;
    const m = message as Record<string, unknown>;
    return (
      m.command === 'editSkill' &&
      typeof m.path === 'string' &&
      typeof m.name === 'string' &&
      typeof m.description === 'string' &&
      typeof m.enabled === 'boolean'
    );
  }

  private handleEditSkill(message: {
    path: string;
    name: string;
    description: string;
    enabled: boolean;
  }): void {
    try {
      this.editor.editSkill(message.path, {
        name: message.name,
        description: message.description,
        enabled: message.enabled,
      });
      vscode.window.showInformationMessage('Skill updated');
      if (this.currentSkill) {
        this.options.onSkillEdited?.({
          ...this.currentSkill,
          name: message.name,
          description: message.description,
          enabled: message.enabled,
        });
      }
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to update skill: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  private renderEmpty(webview: vscode.Webview): string {
    const nonce = getNonce();
    return `${htmlHead(webview, nonce)}<div class="empty">Select an item to view details</div>${htmlFooter(nonce)}`;
  }
}
```

- [ ] **Step 3: Compile**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npx tsc -p tsconfig.test.json`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/panel/renderers/skill.ts src/panel/DetailPanel.ts
git commit -m "feat: add inline skill editing to detail panel"
```

---

### Task 6: Extension wiring + package.json

**Files:**
- Modify: `src/extension.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `ContentCreator` from `./create/ContentCreator`; `ContentMover` from `./move/ContentMover`; `ContentNode` from `./tree/content`; `Skill`, `Command` from `./types`; existing views/refresh functions.
- Produces: four registered commands (`newSkill`, `newCommand`, `moveSkill`, `moveCommand`), `DetailPanel` constructed with `onSkillEdited`, and a fix to the `openSkill`/`openCommand` context-menu handlers.

- [ ] **Step 1: Update imports and state in `src/extension.ts`**

Add imports:

```typescript
import { ContentCreator } from './create/ContentCreator';
import { ContentMover } from './move/ContentMover';
import type { ContentNode } from './tree/content';
import type { Skill, Command } from './types';
```

Add module state (after `updateService` declaration):

```typescript
let contentCreator: ContentCreator;
let contentMover: ContentMover;
```

In `activate`, after `detailPanel = new DetailPanel();` (which becomes `detailPanel = new DetailPanel({ onSkillEdited });`), instantiate:

```typescript
  contentCreator = new ContentCreator();
  contentMover = new ContentMover();
```

- [ ] **Step 2: Fix `openSkill`/`openCommand` context-menu handlers**

Replace the two handlers so they read the path from the tree node passed by the context menu:

```typescript
  // Open Skill command
  const openSkillCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.openSkill#sideBar',
    (node: ContentNode<Skill>) => {
      if (node.type !== 'item') return;
      const uri = vscode.Uri.file(node.item.path);
      vscode.commands.executeCommand('vscode.open', uri);
    },
  );
  context.subscriptions.push(openSkillCommand);

  // Open Command command
  const openCommandCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.openCommand#sideBar',
    (node: ContentNode<Command>) => {
      if (node.type !== 'item') return;
      const uri = vscode.Uri.file(node.item.path ?? '');
      if (node.item.path) {
        vscode.commands.executeCommand('vscode.open', uri);
      }
    },
  );
  context.subscriptions.push(openCommandCommand);
```

- [ ] **Step 3: Register the four new commands**

After the `openPromptCommand` registration, add:

```typescript
  // New Skill command
  const newSkillCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.newSkill#sideBar',
    async () => {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      try {
        await contentCreator.createSkill(workspaceRoot);
        await refreshSkills();
      } catch (err) {
        if (err instanceof Error && err.message.includes('cancelled')) return;
        vscode.window.showErrorMessage(
          err instanceof Error ? err.message : 'Failed to create skill',
        );
      }
    },
  );
  context.subscriptions.push(newSkillCommand);

  // New Command command
  const newCommandCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.newCommand#sideBar',
    async () => {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      try {
        await contentCreator.createCommand(workspaceRoot);
        await refreshCommands();
      } catch (err) {
        if (err instanceof Error && err.message.includes('cancelled')) return;
        vscode.window.showErrorMessage(
          err instanceof Error ? err.message : 'Failed to create command',
        );
      }
    },
  );
  context.subscriptions.push(newCommandCommand);

  // Move Skill command
  const moveSkillCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.moveSkill#sideBar',
    async (node: ContentNode<Skill>) => {
      if (node.type !== 'item') return;
      const item = node.item;
      const dest = item.source === 'global' ? 'Local' : 'Global';
      const action = await vscode.window.showWarningMessage(
        `Move skill "${item.name}" to ${dest}? The original will be removed.`,
        { modal: true },
        'Move',
        'Cancel',
      );
      if (action !== 'Move') return;
      try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        contentMover.moveSkill(item.path, item.source, workspaceRoot);
        await refreshSkills();
      } catch (err) {
        vscode.window.showErrorMessage(
          err instanceof Error ? err.message : 'Failed to move skill',
        );
      }
    },
  );
  context.subscriptions.push(moveSkillCommand);

  // Move Command command
  const moveCommandCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.moveCommand#sideBar',
    async (node: ContentNode<Command>) => {
      if (node.type !== 'item' || !node.item.path) return;
      const item = node.item;
      const dest = item.source === 'file' ? 'Local' : 'Global';
      const action = await vscode.window.showWarningMessage(
        `Move command "${item.name}" to ${dest}? The original will be removed.`,
        { modal: true },
        'Move',
        'Cancel',
      );
      if (action !== 'Move') return;
      try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        contentMover.moveCommand(item.path, item.source, workspaceRoot);
        await refreshCommands();
      } catch (err) {
        vscode.window.showErrorMessage(
          err instanceof Error ? err.message : 'Failed to move command',
        );
      }
    },
  );
  context.subscriptions.push(moveCommandCommand);
```

> Note: `Command.source` is `'file' | 'json'`; the mover treats `'file'` as a global-file source and `'json'` is skipped (guarded by `!node.item.path`). For inline JSON commands there is no file to move, so the context-menu command is only contributed for file commands (see Step 5's `when` clause).

- [ ] **Step 4: Add `onSkillEdited` handler**

Add this function before `onSelection`:

```typescript
function onSkillEdited(updated: Skill): void {
  refreshSkills();
  detailPanel.show(updated);
}
```

- [ ] **Step 5: Update `package.json` — commands + menus**

Add to `contributes.commands`:

```json
{
  "command": "_ho-opencode-explorer.newSkill#sideBar",
  "title": "New Skill",
  "category": "HO OpenCode Explorer",
  "icon": "$(new-file)"
},
{
  "command": "_ho-opencode-explorer.newCommand#sideBar",
  "title": "New Command",
  "category": "HO OpenCode Explorer",
  "icon": "$(new-file)"
},
{
  "command": "_ho-opencode-explorer.moveSkill#sideBar",
  "title": "Move Skill",
  "category": "HO OpenCode Explorer",
  "icon": "$(arrow-swap)"
},
{
  "command": "_ho-opencode-explorer.moveCommand#sideBar",
  "title": "Move Command",
  "category": "HO OpenCode Explorer",
  "icon": "$(arrow-swap)"
}
```

Add to `contributes.menus."view/title"` (after the existing refresh entries):

```json
{
  "command": "_ho-opencode-explorer.newSkill#sideBar",
  "when": "view == ho-opencode-skills",
  "group": "navigation"
},
{
  "command": "_ho-opencode-explorer.newCommand#sideBar",
  "when": "view == ho-opencode-commands",
  "group": "navigation"
}
```

Add to `contributes.menus."view/item/context"`:

```json
{
  "command": "_ho-opencode-explorer.moveSkill#sideBar",
  "when": "view == ho-opencode-skills && viewItem == skill",
  "group": "navigation"
},
{
  "command": "_ho-opencode-explorer.moveCommand#sideBar",
  "when": "view == ho-opencode-commands && viewItem == command",
  "group": "navigation"
}
```

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm run lint`
Expected: PASS (only the pre-existing `no-console` warning).

Run: `npm run package`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/extension.ts package.json
git commit -m "feat: wire create and move commands into extension"
```

---

### Task 7: Full verification and package

**Files:**
- None (verification only).

**Interfaces:**
- Consumes: all tasks above.

- [ ] **Step 1: Compile + typecheck + lint + build**

Run: `npx tsc -p tsconfig.test.json`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm run lint`
Expected: PASS (single pre-existing warning).

Run: `npm run package`
Expected: PASS.

- [ ] **Step 2: Run the integration test suite**

Run: `npm test`
Expected: all suites pass — existing 68 plus `safePaths`, `ContentCreator`, `SkillEditor`, `ContentMover`.

If a suite fails, fix the failing implementation and re-run until green.

- [ ] **Step 3: Package and inspect the VSIX**

Run: `npx @vscode/vsce package --out /tmp/ho-editing-check.vsix`
Expected: package succeeds; contents include `dist/extension.js`, `resources/icon.png`, `package.json`, docs. No `out/`, no `src/`, no `*.map`.

- [ ] **Step 4: Manual smoke test**

Launch the extension host (F5 in VS Code). Verify:
- Skills header shows a **New Skill** button; creating a skill appears in the tree.
- Commands header shows a **New Command** button; creating a command appears in the tree.
- Selecting a skill and clicking **Edit** shows the form; changing name/description/enabled and **Save** persists to the file and re-renders.
- Right-clicking a skill/command shows **Move Skill**/**Move Command**; moving with confirmation relocates the item and refreshes.
- Existing open/copy buttons still work; openSkill/openCommand context menus now actually open the file.

- [ ] **Step 5: Final commit if any fixes were applied**

```bash
git add -A
git commit -m "fix: address verification findings"
```

---

## Self-Review Notes

- **Spec coverage:** Feature 1 (create) → Tasks 1, 2, 6. Feature 2 (edit) → Tasks 3, 5, 6. Feature 3 (move) → Tasks 4, 6. safePaths shared util → Task 1. Wiring + package.json → Task 6. Verification → Task 7. All spec sections mapped, including the `escapeAttr` requirement for the edit form.
- **Placeholders:** No TBD/TODO. All code blocks are complete implementations.
- **Type consistency:** `assertSafeName`/`resolveWithin` signatures match Task 1 usage in Tasks 2-3. `ContentNode<Skill>`/`ContentNode<Command>` types match `./tree/content`. `SkillEditor` `editSkill(filePath, { name, description, enabled })` matches Task 5's DetailPanel call. `ContentMover` `moveSkill/moveCommand(filePath, source, workspaceRoot)` matches Task 6 handlers. The `Command.source` field is `'file' | 'json'`, reflected in the move guard.
- **Known pre-existing bug fixed in Task 6:** `openSkill`/`openCommand` context-menu handlers previously received the tree node but treated it as a string path; Step 2 fixes them to read `node.item.path`.
