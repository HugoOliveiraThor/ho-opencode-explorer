# HO OpenCode Explorer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a VS Code extension sidebar that browses OpenCode skills (global/local) with enable/disable toggles, detail panel, version badge, and update button.

**Architecture:** Extension uses TreeView + TreeDataProvider for the skill list with `checkboxState`, a WebviewView for the detail panel using vanilla HTML + CSS variables, and lightweight modules for scanning skills, toggling YAML frontmatter, and checking GitHub Releases for updates.

**Tech Stack:** TypeScript 5.x (strict), esbuild, mocha + @vscode/test-cli, eslint flat config, prettier, yaml, semver, conventional commits.

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | Extension manifest, scripts, deps, contribution points |
| `tsconfig.json` | TypeScript compiler config (strict mode) |
| `esbuild.config.js` | Bundle config targeting Node 20 |
| `eslint.config.mjs` | ESLint flat config with @typescript-eslint |
| `.prettierrc` | Prettier formatting rules |
| `.vscode-test.js` | Test CLI config (mocha paths) |
| `.vscodeignore` | Exclude from .vsix |
| `.gitignore` | Git ignore rules |
| `src/types.ts` | Shared interfaces (Skill, SkillSource) |
| `src/extension.ts` | activate/deactivate, wire modules, file watchers |
| `src/scanner/SkillsScanner.ts` | Scan directories, parse SKILL.md frontmatter |
| `src/toggle/SkillToggleManager.ts` | Read/write `enabled` field in YAML frontmatter |
| `src/tree/SkillTreeDataProvider.ts` | TreeDataProvider with checkboxState, categorize Global/Local |
| `src/panel/SkillDetailPanel.ts` | WebviewViewProvider, render detail HTML |
| `src/update/UpdateService.ts` | GitHub Releases API, semver compare |
| `src/version/VersionHeader.ts` | Update TreeView title with version badge |
| `src/test/suite/scanner.test.ts` | Scanner unit tests |
| `src/test/suite/toggleManager.test.ts` | Toggle manager unit tests |
| `src/test/suite/updateService.test.ts` | Update service unit tests |
| `src/test/suite/treeProvider.test.ts` | Tree provider integration tests |
| `src/test/runTests.ts` | Test runner entry point |
| `.github/workflows/ci.yml` | Lint + test on ubuntu/macos/windows |
| `.github/workflows/release.yml` | Publish to Marketplace on tag |
| `.github/ISSUE_TEMPLATE/bug_report.md` | Bug report template |
| `.github/ISSUE_TEMPLATE/feature_request.md` | Feature request template |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR checklist |
| `README.md` | Product docs + badges |
| `CONTRIBUTING.md` | Dev setup guide |
| `CODE_OF_CONDUCT.md` | Community guidelines |
| `LICENSE` | MIT license |
| `CHANGELOG.md` | Auto-generated (initial empty) |

---

### Task 1: Project Scaffolding — package.json and Config Files

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.js`
- Create: `eslint.config.mjs`
- Create: `.prettierrc`
- Create: `.vscode-test.js`
- Create: `.vscodeignore`
- Create: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "ho-opencode-explorer",
  "displayName": "HO OpenCode Explorer",
  "description": "Browse and manage OpenCode skills in VS Code sidebar",
  "version": "0.1.0",
  "publisher": "ho",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/ho/ho-opencode-explorer"
  },
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": ["Other"],
  "activationEvents": ["onView:ho-opencode-skills"],
  "main": "./dist/extension.js",
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
  },
  "scripts": {
    "vscode:prepublish": "npm run package",
    "compile": "node esbuild.config.js",
    "watch": "node esbuild.config.js --watch",
    "package": "node esbuild.config.js --production",
    "lint": "eslint src",
    "format": "prettier --write 'src/**/*.ts'",
    "test": "vscode-test",
    "pretest": "npm run compile",
    "release": "standard-version",
    "prepare": "husky"
  },
  "devDependencies": {
    "@types/mocha": "^10.0.10",
    "@types/node": "20.x",
    "@types/vscode": "^1.85.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "@vscode/test-cli": "^0.0.10",
    "@vscode/test-electron": "^2.4.1",
    "commitlint": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0",
    "esbuild": "^0.24.0",
    "eslint": "^9.0.0",
    "husky": "^9.0.0",
    "mocha": "^10.8.0",
    "prettier": "^3.4.0",
    "standard-version": "^9.5.0",
    "typescript": "^5.7.0"
  },
  "dependencies": {
    "yaml": "^2.7.0",
    "semver": "^7.6.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "Node16",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "moduleResolution": "Node16",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "src/test"]
}
```

- [ ] **Step 3: Create esbuild.config.js**

```javascript
const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    target: "node20",
    outfile: "dist/extension.js",
    external: ["vscode"],
    logLevel: "info",
    plugins: [],
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Create eslint.config.mjs**

```javascript
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "esbuild.config.js", ".vscode-test.js"],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": "warn",
    },
  },
];
```

- [ ] **Step 5: Create .prettierrc**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 6: Create .vscode-test.js**

```javascript
const { defineConfig } = require("@vscode/test-cli");

module.exports = defineConfig({
  files: "dist/test/suite/**/*.test.js",
  mocha: {
    ui: "tdd",
    timeout: 20000,
  },
});
```

- [ ] **Step 7: Create .vscodeignore**

```
.vscode/**
.gitignore
src/**
node_modules/**
tsconfig.json
esbuild.config.js
eslint.config.mjs
.prettierrc
.vscode-test.js
.github/**
docs/**
**/*.ts
!dist/**
```

- [ ] **Step 8: Create .gitignore**

```
node_modules
dist
*.vsix
.vscode-test
.superpowers
```

- [ ] **Step 9: Install dependencies and verify compile**

Run: `npm install`
Run: `npm run compile`
Expected: `dist/extension.js` created (empty module for now)

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json esbuild.config.js eslint.config.mjs .prettierrc .vscode-test.js .vscodeignore .gitignore
git commit -m "chore: scaffold project with build, lint, and test config"
```

---

### Task 2: Shared Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write types.ts**

```typescript
export type SkillSource = 'global' | 'local';

export interface Skill {
  name: string;
  description: string;
  path: string;
  enabled: boolean;
  source: SkillSource;
  yamlError?: string;
}

export interface SkillGroup {
  source: SkillSource;
  skills: Skill[];
}
```

- [ ] **Step 2: Verify compile**

Run: `npm run compile`
Expected: Build succeeds with types in dist

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared Skill and SkillGroup types"
```

---

### Task 3: SkillsScanner — Scan and Parse Skills

**Files:**
- Create: `src/scanner/SkillsScanner.ts`
- Create: `src/test/suite/scanner.test.ts`
- Modify: `src/extension.ts` (add placeholder export)

- [ ] **Step 1: Create a test fixtures directory for unit tests**

Run: `mkdir -p src/test/fixtures/skills/valid-skill`
Run: `mkdir -p src/test/fixtures/skills/no-frontmatter`
Run: `mkdir -p src/test/fixtures/skills/invalid-yaml`

- [ ] **Step 2: Create fixture SKILL.md files**

Create `src/test/fixtures/skills/valid-skill/SKILL.md`:
```markdown
---
name: test-skill
description: A test skill for unit tests
enabled: true
---

# Test Skill

This is the content.
```

Create `src/test/fixtures/skills/no-frontmatter/SKILL.md`:
```markdown
# No Frontmatter

Just content, no YAML frontmatter.
```

Create `src/test/fixtures/skills/invalid-yaml/SKILL.md`:
```markdown
---
name: broken
  bad: indentation
enabled: true
---

# Broken YAML

Invalid frontmatter.
```

- [ ] **Step 3: Write the failing test for scanner**

Create `src/test/suite/scanner.test.ts`:

```typescript
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { SkillsScanner } from '../../scanner/SkillsScanner';
import type { Skill } from '../../types';

suite('SkillsScanner', () => {
  const fixturesDir = path.resolve(__dirname, '..', 'fixtures', 'skills');
  const scanner = new SkillsScanner();

  test('detects skill directory containing SKILL.md', () => {
    const dir = path.join(fixturesDir, 'valid-skill');
    const hasSkill = (scanner as any).hasSkillFile(dir);
    assert.strictEqual(hasSkill, true);
  });

  test('returns false for directory without SKILL.md', () => {
    const dir = os.tmpdir();
    const hasSkill = (scanner as any).hasSkillFile(dir);
    assert.strictEqual(hasSkill, false);
  });

  test('parses valid SKILL.md with frontmatter', () => {
    const filePath = path.join(fixturesDir, 'valid-skill', 'SKILL.md');
    const skill = (scanner as any).parseSkillFile(filePath, 'global');
    assert.strictEqual(skill.name, 'test-skill');
    assert.strictEqual(skill.description, 'A test skill for unit tests');
    assert.strictEqual(skill.enabled, true);
    assert.strictEqual(skill.source, 'global');
    assert.strictEqual(skill.path, filePath);
  });

  test('handles SKILL.md without frontmatter', () => {
    const filePath = path.join(fixturesDir, 'no-frontmatter', 'SKILL.md');
    const skill = (scanner as any).parseSkillFile(filePath, 'local');
    assert.strictEqual(skill.enabled, true);
    assert.ok(skill.name.length > 0);
  });

  test('handles SKILL.md with invalid YAML', () => {
    const filePath = path.join(fixturesDir, 'invalid-yaml', 'SKILL.md');
    const skill = (scanner as any).parseSkillFile(filePath, 'global');
    assert.ok(skill.yamlError);
    assert.strictEqual(skill.enabled, false);
  });

  test('scans a directory and returns skills', async () => {
    const skills = await scanner.scanDirectory(fixturesDir, 'global');
    assert.ok(skills.length >= 3);
    const valid = skills.find((s: Skill) => s.name === 'test-skill');
    assert.ok(valid);
    assert.strictEqual(valid!.enabled, true);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm run compile && npm run test`
Expected: FAIL — SkillsScanner module not found

- [ ] **Step 5: Write SkillsScanner implementation**

Create `src/scanner/SkillsScanner.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import type { Skill, SkillSource } from '../types';

interface SkillFrontmatter {
  name?: string;
  description?: string;
  enabled?: boolean;
}

export class SkillsScanner {
  private readonly globalPaths: string[] = [];
  private readonly localPath: string = '.opencode/skills';

  constructor() {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    this.globalPaths = [
      path.join(home, '.config', 'opencode', 'skills'),
      path.join(home, '.opencode', 'skills'),
      path.join(home, '.cache', 'opencode', 'packages'),
    ];
  }

  async scanAll(workspaceRoot?: string): Promise<{ global: Skill[]; local: Skill[] }> {
    const globalSkills = await this.scanGlobalPaths();
    const localSkills = workspaceRoot ? await this.scanDirectory(path.join(workspaceRoot, this.localPath), 'local') : [];
    return { global: globalSkills, local: localSkills };
  }

  private async scanGlobalPaths(): Promise<Skill[]> {
    const results: Skill[] = [];
    for (const dir of this.globalPaths) {
      const skills = await this.scanDirectory(dir, 'global');
      results.push(...skills);
    }
    return results;
  }

  async scanDirectory(dirPath: string, source: SkillSource): Promise<Skill[]> {
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    const skills: Skill[] = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const fullPath = path.join(dirPath, entry.name);

      if (this.isPackageDir(dirPath)) {
        const nested = await this.scanPackageDir(fullPath, source);
        skills.push(...nested);
      } else if (this.hasSkillFile(fullPath)) {
        const skill = this.parseSkillFile(path.join(fullPath, 'SKILL.md'), source);
        skills.push(skill);
      }
    }

    return skills;
  }

  private isPackageDir(dirPath: string): boolean {
    return dirPath.includes('opencode/packages');
  }

  private async scanPackageDir(pkgPath: string, source: SkillSource): Promise<Skill[]> {
    const skills: Skill[] = [];
    const nodeModules = path.join(pkgPath, 'node_modules');
    if (!fs.existsSync(nodeModules)) return skills;

    const packages = fs.readdirSync(nodeModules, { withFileTypes: true });
    for (const pkg of packages) {
      if (!pkg.isDirectory()) continue;
      const skillsDir = path.join(nodeModules, pkg.name, 'skills');
      if (fs.existsSync(skillsDir)) {
        const nested = await this.scanDirectory(skillsDir, source);
        skills.push(...nested);
      }
    }
    return skills;
  }

  private hasSkillFile(dirPath: string): boolean {
    return fs.existsSync(path.join(dirPath, 'SKILL.md'));
  }

  private parseSkillFile(filePath: string, source: SkillSource): Skill {
    const dirName = path.basename(path.dirname(filePath));
    const content = fs.readFileSync(filePath, 'utf-8');

    try {
      const frontmatter = this.extractFrontmatter(content);
      if (frontmatter) {
        const parsed = YAML.parse(frontmatter) as SkillFrontmatter;
        return {
          name: parsed.name || dirName,
          description: parsed.description || '',
          path: filePath,
          enabled: parsed.enabled !== false,
          source,
        };
      }
    } catch (err) {
      return {
        name: dirName,
        description: '',
        path: filePath,
        enabled: false,
        source,
        yamlError: err instanceof Error ? err.message : 'Unknown YAML error',
      };
    }

    return {
      name: dirName,
      description: '',
      path: filePath,
      enabled: true,
      source,
    };
  }

  private extractFrontmatter(content: string): string | null {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    return match ? match[1]! : null;
  }
}
```

- [ ] **Step 6: Create placeholder extension.ts**

Create `src/extension.ts`:

```typescript
import * as vscode from 'vscode';

export function activate(_context: vscode.ExtensionContext) {
  // Will be wired in later tasks
}

export function deactivate() {
  // Will be wired in later tasks
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run compile && npm run test`
Expected: All scanner tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/scanner/SkillsScanner.ts src/extension.ts src/test/suite/scanner.test.ts src/test/fixtures/
git commit -m "feat: add SkillsScanner with YAML frontmatter parsing"
```

---

### Task 4: SkillToggleManager — Toggle enabled in SKILL.md

**Files:**
- Create: `src/toggle/SkillToggleManager.ts`
- Create: `src/test/suite/toggleManager.test.ts`

- [ ] **Step 1: Write the failing test for toggle manager**

Create `src/test/suite/toggleManager.test.ts`:

```typescript
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { SkillToggleManager } from '../../toggle/SkillToggleManager';

suite('SkillToggleManager', () => {
  let tmpDir: string;
  let skillFile: string;
  let manager: SkillToggleManager;

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toggle-test-'));
    skillFile = path.join(tmpDir, 'SKILL.md');
    manager = new SkillToggleManager();
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('toggles enabled from true to false', () => {
    fs.writeFileSync(
      skillFile,
      '---\nname: test\ndescription: desc\nenabled: true\n---\n\n# Content\n',
    );
    manager.toggle(skillFile);
    const content = fs.readFileSync(skillFile, 'utf-8');
    assert.ok(content.includes('enabled: false'));
  });

  test('toggles enabled from false to true', () => {
    fs.writeFileSync(
      skillFile,
      '---\nname: test\nenabled: false\n---\n\n# Content\n',
    );
    manager.toggle(skillFile);
    const content = fs.readFileSync(skillFile, 'utf-8');
    assert.ok(content.includes('enabled: true'));
  });

  test('adds enabled field when missing from frontmatter', () => {
    fs.writeFileSync(skillFile, '---\nname: test\n---\n\n# Content\n');
    manager.toggle(skillFile);
    const content = fs.readFileSync(skillFile, 'utf-8');
    assert.ok(content.includes('enabled: false'));
  });

  test('adds enabled field when no frontmatter exists', () => {
    fs.writeFileSync(skillFile, '# No frontmatter\n\nJust content.\n');
    manager.toggle(skillFile);
    const content = fs.readFileSync(skillFile, 'utf-8');
    assert.ok(content.includes('enabled: false'));
    assert.ok(content.startsWith('---\n'));
  });

  test('reads enabled state from file', () => {
    fs.writeFileSync(
      skillFile,
      '---\nname: test\nenabled: false\n---\n\n# Content\n',
    );
    const enabled = manager.isEnabled(skillFile);
    assert.strictEqual(enabled, false);
  });

  test('returns true when reading file without enabled field', () => {
    fs.writeFileSync(skillFile, '---\nname: test\n---\n\n# Content\n');
    const enabled = manager.isEnabled(skillFile);
    assert.strictEqual(enabled, true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run compile && npm run test`
Expected: FAIL — SkillToggleManager module not found

- [ ] **Step 3: Write SkillToggleManager implementation**

Create `src/toggle/SkillToggleManager.ts`:

```typescript
import * as fs from 'fs';
import * as YAML from 'yaml';

export class SkillToggleManager {
  toggle(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const newContent = this.toggleEnabledInContent(content);
    fs.writeFileSync(filePath, newContent);
  }

  isEnabled(filePath: string): boolean {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match || !match[1]) return true;
    try {
      const parsed = YAML.parse(match[1]) as { enabled?: boolean };
      return parsed.enabled !== false;
    } catch {
      return true;
    }
  }

  private toggleEnabledInContent(content: string): string {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) {
      return `---\nenabled: false\n---\n\n${content}`;
    }

    const frontmatter = frontmatterMatch[1]!;
    const rest = content.slice(frontmatterMatch[0].length);

    if (frontmatter.includes('enabled:')) {
      const toggled = frontmatter.replace(
        /^enabled:\s*(true|false)/m,
        (_match, val) => (val === 'true' ? 'enabled: false' : 'enabled: true'),
      );
      return `---\n${toggled}\n---${rest}`;
    }

    return `---\n${frontmatter}\nenabled: false\n---${rest}`;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run compile && npm run test`
Expected: Toggle manager tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/toggle/SkillToggleManager.ts src/test/suite/toggleManager.test.ts
git commit -m "feat: add SkillToggleManager for enable/disable via YAML frontmatter"
```

---

### Task 5: SkillTreeDataProvider — TreeView with Checkboxes

**Files:**
- Create: `src/tree/SkillTreeDataProvider.ts`
- Create: `src/test/suite/treeProvider.test.ts`

- [ ] **Step 1: Write the failing test for tree provider**

Create `src/test/suite/treeProvider.test.ts`:

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';
import { SkillTreeDataProvider } from '../../tree/SkillTreeDataProvider';
import type { Skill } from '../../types';

suite('SkillTreeDataProvider', () => {
  const globalSkill: Skill = {
    name: 'test-global',
    description: 'A global skill',
    path: '/home/user/.config/opencode/skills/test-global/SKILL.md',
    enabled: true,
    source: 'global',
  };

  const localSkill: Skill = {
    name: 'test-local',
    description: 'A local skill',
    path: '/workspace/.opencode/skills/test-local/SKILL.md',
    enabled: false,
    source: 'local',
  };

  const provider = new SkillTreeDataProvider();

  test('getChildren on root returns Global and Local category nodes', () => {
    provider.setSkills([globalSkill], [localSkill]);
    const children = provider.getChildren();
    assert.strictEqual(children.length, 2);
    assert.strictEqual(children[0]!.label, 'Global Skills');
    assert.strictEqual(children[1]!.label, 'Local Skills');
  });

  test('getChildren on Global node returns skill items', () => {
    provider.setSkills([globalSkill], []);
    const root = provider.getChildren();
    const globalNode = root.find((n) => n.label === 'Global Skills');
    const skills = provider.getChildren(globalNode);
    assert.strictEqual(skills.length, 1);
    assert.strictEqual(skills[0]!.label, 'test-global');
  });

  test('checkboxState reflects enabled status', () => {
    provider.setSkills([globalSkill], [localSkill]);
    const root = provider.getChildren();
    const globalNode = root.find((n) => n.label === 'Global Skills');
    const skills = provider.getChildren(globalNode);
    const enabledSkill = skills.find((s) => s.label === 'test-global');
    assert.strictEqual(
      enabledSkill!.checkboxState,
      vscode.TreeItemCheckboxState.Checked,
    );
  });

  test('disabled skill has Unchecked checkboxState', () => {
    provider.setSkills([], [localSkill]);
    const root = provider.getChildren();
    const localNode = root.find((n) => n.label === 'Local Skills');
    const skills = provider.getChildren(localNode);
    assert.strictEqual(
      skills[0]!.checkboxState,
      vscode.TreeItemCheckboxState.Unchecked,
    );
  });

  test('hides Local Skills section when no local skills', () => {
    provider.setSkills([globalSkill], []);
    const root = provider.getChildren();
    assert.strictEqual(root.length, 1);
    assert.strictEqual(root[0]!.label, 'Global Skills');
  });

  test('hides Global Skills section when no global skills', () => {
    provider.setSkills([], [localSkill]);
    const root = provider.getChildren();
    assert.strictEqual(root.length, 1);
    assert.strictEqual(root[0]!.label, 'Local Skills');
  });

  test('counts shown in category labels', () => {
    provider.setSkills([globalSkill, globalSkill], [localSkill]);
    const root = provider.getChildren();
    const globalNode = root.find((n) => n.label === 'Global Skills');
    assert.ok((globalNode!.label as string).includes('(2)'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run compile && npm run test`
Expected: FAIL — SkillTreeDataProvider module not found

- [ ] **Step 3: Write SkillTreeDataProvider implementation**

Create `src/tree/SkillTreeDataProvider.ts`:

```typescript
import * as vscode from 'vscode';
import type { Skill } from '../types';

type TreeNode = CategoryNode | SkillNode;

interface CategoryNode {
  type: 'category';
  label: string;
  source: 'global' | 'local';
}

interface SkillNode {
  type: 'skill';
  label: string;
  skill: Skill;
}

export class SkillTreeDataProvider
  implements vscode.TreeDataProvider<TreeNode>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    TreeNode | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private globalSkills: Skill[] = [];
  private localSkills: Skill[] = [];

  setSkills(global: Skill[], local: Skill[]): void {
    this.globalSkills = global;
    this.localSkills = local;
    this._onDidChangeTreeData.fire();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    if (element.type === 'category') {
      const count =
        element.source === 'global'
          ? this.globalSkills.length
          : this.localSkills.length;
      const item = new vscode.TreeItem(
        `${element.label} (${count})`,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.contextValue = 'category';
      return item;
    }

    const item = new vscode.TreeItem(element.skill.name);
    item.contextValue = 'skill';
    item.checkboxState = element.skill.enabled
      ? vscode.TreeItemCheckboxState.Checked
      : vscode.TreeItemCheckboxState.Unchecked;
    item.description = element.skill.path;
    item.tooltip = element.skill.description || element.skill.name;
    if (element.skill.yamlError) {
      item.iconPath = new vscode.ThemeIcon('warning');
    }
    return item;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      const categories: TreeNode[] = [];
      if (this.globalSkills.length > 0) {
        categories.push({
          type: 'category',
          label: 'Global Skills',
          source: 'global',
        });
      }
      if (this.localSkills.length > 0) {
        categories.push({
          type: 'category',
          label: 'Local Skills',
          source: 'local',
        });
      }
      return categories;
    }

    if (element.type === 'category') {
      const skills =
        element.source === 'global' ? this.globalSkills : this.localSkills;
      return skills.map((skill) => ({
        type: 'skill' as const,
        label: skill.name,
        skill,
      }));
    }

    return [];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run compile && npm run test`
Expected: Tree provider tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/tree/SkillTreeDataProvider.ts src/test/suite/treeProvider.test.ts
git commit -m "feat: add SkillTreeDataProvider with Global/Local categories and checkboxes"
```

---

### Task 6: SkillDetailPanel — WebviewView for Skill Details

**Files:**
- Create: `src/panel/SkillDetailPanel.ts`

- [ ] **Step 1: Write SkillDetailPanel**

Create `src/panel/SkillDetailPanel.ts`:

```typescript
import * as vscode from 'vscode';
import type { Skill } from '../types';

export class SkillDetailPanel implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
    };
    webviewView.webview.html = this.getEmptyHtml();
    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.command === 'openFile') {
        const uri = vscode.Uri.file(message.path);
        vscode.commands.executeCommand('vscode.open', uri);
      } else if (message.command === 'copyPath') {
        vscode.env.clipboard.writeText(message.path);
        vscode.window.showInformationMessage('Path copied to clipboard');
      }
    });
  }

  showSkill(skill: Skill): void {
    if (!this._view) return;
    this._view.show(true);
    this._view.webview.html = this.getSkillHtml(skill);
  }

  clear(): void {
    if (!this._view) return;
    this._view.webview.html = this.getEmptyHtml();
  }

  private getEmptyHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Skill Details</title>
  <style>
    body {
      padding: 12px;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      background: var(--vscode-editor-background);
    }
    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 60px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="empty">Select a skill to view details</div>
</body>
</html>`;
  }

  private getSkillHtml(skill: Skill): string {
    const warningIcon = skill.yamlError ? '⚠️ ' : '';
    const enabledBadge = skill.enabled
      ? '<span style="background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);padding:1px 6px;border-radius:8px;font-size:10px">enabled</span>'
      : '<span style="background:var(--vscode-inputValidation-errorBackground);color:var(--vscode-inputValidation-errorForeground);padding:1px 6px;border-radius:8px;font-size:10px">disabled</span>';

    const errorBlock = skill.yamlError
      ? `<div style="margin-top:8px;padding:8px;background:var(--vscode-inputValidation-errorBackground);border:1px solid var(--vscode-inputValidation-errorBorder);border-radius:4px;font-size:11px"><strong>⚠️ YAML Error:</strong> ${this.escapeHtml(skill.yamlError)}</div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Skill Details</title>
  <style>
    body {
      padding: 12px;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      background: var(--vscode-editor-background);
    }
    h2 {
      margin: 0 0 4px 0;
      font-size: 14px;
      font-weight: 600;
    }
    .path {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      word-break: break-all;
    }
    .desc {
      font-size: 12px;
      color: var(--vscode-foreground);
      margin-bottom: 12px;
      line-height: 1.4;
    }
    .actions {
      display: flex;
      gap: 8px;
    }
    button {
      padding: 3px 10px;
      border: none;
      border-radius: 2px;
      cursor: pointer;
      font-size: 11px;
      font-family: var(--vscode-font-family);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .source-badge {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 1px 6px;
      border-radius: 8px;
      font-size: 10px;
    }
    hr {
      border: none;
      border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
      margin: 8px 0;
    }
    .label {
      font-size: 10px;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="header-row">
    <h2>${warningIcon}${this.escapeHtml(skill.name)}</h2>
    ${enabledBadge}
  </div>
  <div class="path">${this.escapeHtml(skill.path)}</div>
  <span class="source-badge">${skill.source}</span>
  ${skill.description ? `<hr><div class="label">DESCRIPTION</div><div class="desc">${this.escapeHtml(skill.description)}</div>` : ''}
  ${errorBlock}
  <hr>
  <div class="actions">
    <button onclick="openFile('${this.escapeAttr(skill.path)}')">📂 Open SKILL.md</button>
    <button onclick="copyPath('${this.escapeAttr(skill.path)}')">📋 Copy Path</button>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    function openFile(path) { vscode.postMessage({ command: 'openFile', path }); }
    function copyPath(path) { vscode.postMessage({ command: 'copyPath', path }); }
  </script>
</body>
</html>`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private escapeAttr(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
}
```

- [ ] **Step 2: Verify compile**

Run: `npm run compile`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/panel/SkillDetailPanel.ts
git commit -m "feat: add SkillDetailPanel WebviewView with detail HTML"
```

---

### Task 7: UpdateService — Check GitHub Releases

**Files:**
- Create: `src/update/UpdateService.ts`
- Create: `src/test/suite/updateService.test.ts`

- [ ] **Step 1: Write the failing test for update service**

Create `src/test/suite/updateService.test.ts`:

```typescript
import * as assert from 'assert';
import { UpdateService } from '../../update/UpdateService';

suite('UpdateService', () => {
  test('isUpdateAvailable returns false when local is same as remote', () => {
    const service = new UpdateService();
    const result = service.isUpdateAvailable('1.2.3', '1.2.3');
    assert.strictEqual(result, false);
  });

  test('isUpdateAvailable returns true when remote is newer', () => {
    const service = new UpdateService();
    const result = service.isUpdateAvailable('1.2.3', '2.0.0');
    assert.strictEqual(result, true);
  });

  test('isUpdateAvailable returns false when local is newer', () => {
    const service = new UpdateService();
    const result = service.isUpdateAvailable('2.0.0', '1.2.3');
    assert.strictEqual(result, false);
  });

  test('isUpdateAvailable handles pre-release versions', () => {
    const service = new UpdateService();
    const result = service.isUpdateAvailable('1.2.3', '1.3.0-beta.1');
    assert.strictEqual(result, false);
  });

  test('getLocalVersion reads from package.json-style version string', () => {
    const service = new UpdateService();
    const version = service.parseVersion('v1.2.3');
    assert.strictEqual(version, '1.2.3');
  });

  test('parseVersion strips leading v', () => {
    const service = new UpdateService();
    assert.strictEqual(service.parseVersion('v0.1.0'), '0.1.0');
    assert.strictEqual(service.parseVersion('2.0.0'), '2.0.0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run compile && npm run test`
Expected: FAIL — UpdateService module not found

- [ ] **Step 3: Write UpdateService implementation**

Create `src/update/UpdateService.ts`:

```typescript
import * as vscode from 'vscode';
import * as semver from 'semver';

export class UpdateService {
  private readonly repoOwner: string;
  private readonly repoName: string;

  constructor(repoOwner: string = 'ho', repoName: string = 'ho-opencode-explorer') {
    this.repoOwner = repoOwner;
    this.repoName = repoName;
  }

  isUpdateAvailable(localVersion: string, remoteVersion: string): boolean {
    const local = semver.parse(localVersion);
    const remote = semver.parse(remoteVersion);

    if (!local || !remote) return false;

    return semver.gt(remote, local);
  }

  parseVersion(raw: string): string {
    return raw.replace(/^v/, '');
  }

  async checkForUpdates(localVersion: string): Promise<void> {
    try {
      const url = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest`;
      const response = await fetch(url, {
        headers: { Accept: 'application/vnd.github.v3+json' },
      });

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }

      const release = (await response.json()) as { tag_name: string; html_url: string };
      const remoteVersion = this.parseVersion(release.tag_name);

      if (this.isUpdateAvailable(localVersion, remoteVersion)) {
        const action = await vscode.window.showInformationMessage(
          `HO OpenCode Explorer v${remoteVersion} is available. Update now?`,
          'Install',
          'Later',
        );
        if (action === 'Install') {
          vscode.env.openExternal(vscode.Uri.parse(release.html_url));
        }
      } else {
        vscode.window.showInformationMessage(
          `HO OpenCode Explorer is up to date (v${localVersion})`,
        );
      }
    } catch (err) {
      vscode.window.showWarningMessage(
        'Could not check for updates. Check your internet connection.',
      );
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run compile && npm run test`
Expected: Update service tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/update/UpdateService.ts src/test/suite/updateService.test.ts
git commit -m "feat: add UpdateService with GitHub Releases version check"
```

---

### Task 8: Wire Everything in extension.ts

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: Rewrite extension.ts with full activation logic**

```typescript
import * as vscode from 'vscode';
import { SkillsScanner } from './scanner/SkillsScanner';
import { SkillTreeDataProvider } from './tree/SkillTreeDataProvider';
import { SkillDetailPanel } from './panel/SkillDetailPanel';
import { SkillToggleManager } from './toggle/SkillToggleManager';
import { UpdateService } from './update/UpdateService';

let scanner: SkillsScanner;
let treeProvider: SkillTreeDataProvider;
let detailPanel: SkillDetailPanel;
let toggleManager: SkillToggleManager;
let updateService: UpdateService;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

export function activate(context: vscode.ExtensionContext): void {
  scanner = new SkillsScanner();
  treeProvider = new SkillTreeDataProvider();
  toggleManager = new SkillToggleManager();
  updateService = new UpdateService();
  detailPanel = new SkillDetailPanel();

  const treeView = vscode.window.createTreeView('ho-opencode-skills', {
    treeDataProvider: treeProvider,
    canSelectMany: false,
  });
  context.subscriptions.push(treeView);

  const panelRegistration = vscode.window.registerWebviewViewProvider(
    'ho-opencode-skill-detail',
    detailPanel,
    { webviewOptions: { retainContextWhenHidden: false } },
  );
  context.subscriptions.push(panelRegistration);

  treeView.onDidChangeSelection((event) => {
    const node = event.selection[0];
    if (node && node.type === 'skill') {
      detailPanel.showSkill(node.skill);
    } else {
      detailPanel.clear();
    }
  });

  treeView.onDidChangeCheckboxState(async (event) => {
    for (const [node, state] of event.items) {
      if (node.type === 'skill') {
        try {
          const newEnabled = state === vscode.TreeItemCheckboxState.Checked;
          if (newEnabled !== node.skill.enabled) {
            toggleManager.toggle(node.skill.path);
          }
        } catch (err) {
          vscode.window.showErrorMessage(
            `Failed to toggle skill: ${err instanceof Error ? err.message : 'Unknown error'}`,
          );
        }
      }
    }
    await refreshSkills();
  });

  const updateCommand = vscode.commands.registerCommand(
    'ho-opencode-explorer.checkForUpdates',
    async () => {
      const packageJson = context.extension.packageJSON as { version: string };
      await updateService.checkForUpdates(packageJson.version);
    },
  );
  context.subscriptions.push(updateCommand);

  const refreshCommand = vscode.commands.registerCommand(
    'ho-opencode-explorer.refreshSkills',
    refreshSkills,
  );
  context.subscriptions.push(refreshCommand);

  const openSkillCommand = vscode.commands.registerCommand(
    'ho-opencode-explorer.openSkill',
    (skillPath: string) => {
      const uri = vscode.Uri.file(skillPath);
      vscode.commands.executeCommand('vscode.open', uri);
    },
  );
  context.subscriptions.push(openSkillCommand);

  setupFileWatchers(context);
  updateViewTitle();

  refreshSkills();
}

function setupFileWatchers(context: vscode.ExtensionContext): void {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const patterns = [
    new vscode.RelativePattern(
      vscode.Uri.file(home),
      '.config/opencode/skills/**/SKILL.md',
    ),
    new vscode.RelativePattern(vscode.Uri.file(home), '.opencode/skills/**/SKILL.md'),
    new vscode.RelativePattern(
      vscode.Uri.file(home),
      '.cache/opencode/packages/**/SKILL.md',
    ),
  ];

  for (const pattern of patterns) {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidChange(debouncedRefresh);
    watcher.onDidCreate(debouncedRefresh);
    watcher.onDidDelete(debouncedRefresh);
    context.subscriptions.push(watcher);
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    const localPattern = new vscode.RelativePattern(
      workspaceFolders[0]!,
      '.opencode/skills/**/SKILL.md',
    );
    const localWatcher = vscode.workspace.createFileSystemWatcher(localPattern);
    localWatcher.onDidChange(debouncedRefresh);
    localWatcher.onDidCreate(debouncedRefresh);
    localWatcher.onDidDelete(debouncedRefresh);
    context.subscriptions.push(localWatcher);
  }
}

function debouncedRefresh(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => refreshSkills(), 500);
}

async function refreshSkills(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

  const { global, local } = await scanner.scanAll(workspaceRoot);
  treeProvider.setSkills(global, local);
  updateViewTitle();
}

function updateViewTitle(): void {
  const packageJson = vscode.extensions.getExtension('ho.ho-opencode-explorer')
    ?.packageJSON as { version: string } | undefined;
  const version = packageJson?.version || '0.0.0';
  vscode.commands.executeCommand(
    'setContext',
    'ho-opencode-explorer.version',
    `v${version}`,
  );
}

export function deactivate(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }

  treeProvider = undefined!;
  scanner = undefined!;
  detailPanel = undefined!;
  toggleManager = undefined!;
  updateService = undefined!;
}
```

- [ ] **Step 2: Update package.json with commands and detail view**

Edit `package.json` to add commands and the detail webview view. Replace the `contributes` block:

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
        },
        {
          "id": "ho-opencode-skill-detail",
          "name": "Skill Details",
          "type": "webview"
        }
      ]
    },
    "commands": [
      {
        "command": "ho-opencode-explorer.checkForUpdates",
        "title": "Check for Updates",
        "icon": "$(refresh)"
      },
      {
        "command": "ho-opencode-explorer.refreshSkills",
        "title": "Refresh Skills",
        "icon": "$(refresh)"
      },
      {
        "command": "ho-opencode-explorer.openSkill",
        "title": "Open SKILL.md"
      }
    ],
    "menus": {
      "view/title": [
        {
          "command": "ho-opencode-explorer.checkForUpdates",
          "when": "view == ho-opencode-skills",
          "group": "navigation"
        },
        {
          "command": "ho-opencode-explorer.refreshSkills",
          "when": "view == ho-opencode-skills",
          "group": "navigation"
        }
      ],
      "view/item/context": [
        {
          "command": "ho-opencode-explorer.openSkill",
          "when": "view == ho-opencode-skills && viewItem == skill",
          "group": "inline"
        }
      ]
    }
  }
}
```

- [ ] **Step 3: Verify compile**

Run: `npm run compile`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/extension.ts package.json
git commit -m "feat: wire extension activation with tree, detail panel, watchers, and commands"
```

---

### Task 9: Add test runner entry point

**Files:**
- Create: `src/test/runTests.ts`

- [ ] **Step 1: Write runTests.ts**

Create `src/test/runTests.ts`:

```typescript
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ['--disable-extensions'],
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 2: Create test suite index**

Create `src/test/suite/index.ts`:

```typescript
import * as path from 'path';
import * as Mocha from 'mocha';
import { glob } from 'glob';

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 20000,
  });

  const testsRoot = path.resolve(__dirname);

  return glob('**/**.test.js', { cwd: testsRoot })
    .then((files: string[]) => {
      for (const f of files) {
        mocha.addFile(path.resolve(testsRoot, f));
      }

      return new Promise<void>((resolve, reject) => {
        mocha.run((failures: number) => {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        });
      });
    })
    .catch((err: Error) => {
      throw err;
    });
}
```

- [ ] **Step 3: Verify tests run end-to-end**

Run: `npm run compile && npm run test`
Expected: All test suites PASS (scanner, toggleManager, treeProvider, updateService)

- [ ] **Step 4: Commit**

```bash
git add src/test/runTests.ts src/test/suite/index.ts
git commit -m "test: add test runner entry point and suite index"
```

---

### Task 10: CI/CD GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: ['20']
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run compile
      - name: Run tests (Linux only)
        run: xvfb-run -a npm test
        if: runner.os == 'Linux'
      - name: Run tests (macOS/Windows)
        run: npm test
        if: runner.os != 'Linux'
```

- [ ] **Step 2: Create release workflow**

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run compile
      - name: Publish to VS Code Marketplace
        run: npx @vscode/vsce publish -p ${{ secrets.VSCE_TOKEN }}
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/release.yml
git commit -m "ci: add GitHub Actions CI and release workflows"
```

---

### Task 11: Open Source Documentation

**Files:**
- Create: `README.md`
- Create: `CONTRIBUTING.md`
- Create: `CODE_OF_CONDUCT.md`
- Create: `LICENSE`
- Create: `.github/ISSUE_TEMPLATE/bug_report.md`
- Create: `.github/ISSUE_TEMPLATE/feature_request.md`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`
- Create: `CHANGELOG.md`

- [ ] **Step 1: Create README.md**

```markdown
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
```

- [ ] **Step 2: Create CONTRIBUTING.md**

```markdown
# Contributing to HO OpenCode Explorer

## Development Setup

```bash
git clone https://github.com/ho/ho-opencode-explorer.git
cd ho-opencode-explorer
npm install
npm run compile
```

Press F5 in VS Code to launch the Extension Development Host.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run compile` | Build the extension |
| `npm run watch` | Build and watch for changes |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm test` | Run tests |
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
```

- [ ] **Step 3: Create CODE_OF_CONDUCT.md**

```markdown
# Code of Conduct

## Our Pledge

We pledge to make participation in this project a harassment-free experience for everyone.

## Our Standards

- Be respectful and inclusive
- Provide constructive feedback
- Accept constructive criticism gracefully

## Enforcement

Report violations to the project maintainers.
```

- [ ] **Step 4: Create LICENSE (MIT)**

```text
MIT License

Copyright (c) 2026 Hugo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 5: Create issue and PR templates**

Create `.github/ISSUE_TEMPLATE/bug_report.md`:

```markdown
---
name: Bug Report
about: Report a bug
title: 'bug: '
labels: bug
---

**Description**
A clear description of the bug.

**Steps to Reproduce**
1.
2.
3.

**Expected behavior**
What should happen.

**Environment**
- VS Code version:
- Extension version:
- OS:
```

Create `.github/ISSUE_TEMPLATE/feature_request.md`:

```markdown
---
name: Feature Request
about: Suggest a feature
title: 'feat: '
labels: enhancement
---

**Description**
A clear description of the feature.

**Use Case**
Why this would be useful.
```

Create `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Summary

Brief description of changes.

## Checklist

- [ ] Tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Conventional commit messages
- [ ] Relevant documentation updated
```

- [ ] **Step 6: Create empty CHANGELOG.md**

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
```

- [ ] **Step 7: Commit**

```bash
git add README.md CONTRIBUTING.md CODE_OF_CONDUCT.md LICENSE CHANGELOG.md .github/
git commit -m "docs: add open source documentation and community files"
```

---

### Task 12: Setup Husky and Commitlint

**Files:**
- Create: `.husky/commit-msg`
- Create: `.husky/pre-commit`
- Create: `commitlint.config.js`

- [ ] **Step 1: Initialize husky and create configs**

Run: `npx husky init`

Create `commitlint.config.js`:

```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
};
```

Create `.husky/commit-msg`:

```bash
npx --no -- commitlint --edit $1
```

Create `.husky/pre-commit`:

```bash
npm run lint
npm run compile
```

- [ ] **Step 2: Verify setup**

Run: `npx commitlint --from HEAD~1 --to HEAD`
Expected: Should pass or warn about no commits

- [ ] **Step 3: Commit**

```bash
git add .husky/ commitlint.config.js
git commit -m "chore: setup husky and commitlint for conventional commits"
```

---

### Task 13: Final Integration Verification

- [ ] **Step 1: Run full pipeline**

Run: `npm run lint`
Expected: PASS (no errors)

Run: `npm run compile`
Expected: Build succeeds, `dist/extension.js` created

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 2: Verify .vsix size**

Run: `npx @vscode/vsce package`
Expected: .vsix created, size < 500KB

- [ ] **Step 3: Launch extension in debug**

Open the project in VS Code, press F5. In the Extension Development Host:
- Click the HO OpenCode Explorer icon in the activity bar
- Verify skills appear in Global and Local sections
- Toggle a checkbox and confirm SKILL.md frontmatter updates
- Click a skill name and verify detail panel shows
- Click the update button and verify version check

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final integration verification and cleanup"
```
