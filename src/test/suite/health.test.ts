import * as assert from 'assert';
import * as path from 'path';
import { checkFrontmatter } from '../../health/rules/FrontmatterRule.js';
import { checkBrokenRefs, commandExists } from '../../health/rules/BrokenRefsRule.js';
import { checkDuplicateNames } from '../../health/rules/DuplicateNamesRule.js';
import { HealthTreeProvider } from '../../health/HealthTreeProvider.js';
import type { ScanResults, HealthIssue } from '../../health/types.js';

const p = (rel: string): string => path.resolve(__dirname, '..', '..', '..', 'src', rel);

function emptyResults(): ScanResults {
  return {
    skills: { global: [], local: [] },
    commands: [],
    agents: { config: [], global: [], local: [] },
    mcp: { global: [], project: [] },
    prompts: { global: [], local: [] },
  };
}

function severities(issues: HealthIssue[]): string[] {
  return issues.map((issue) => issue.severity);
}

suite('FrontmatterRule', () => {
  test('flags invalid skill YAML as error', () => {
    const results = emptyResults();
    results.skills.global.push({
      itemType: 'skill',
      name: 'broken',
      description: '',
      path: p('test/fixtures/skills/invalid-yaml/SKILL.md'),
      enabled: false,
      source: 'global',
      yamlError: 'bad indentation',
    });
    const issues = checkFrontmatter(results);
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0]!.severity, 'error');
    assert.strictEqual(issues[0]!.rule, 'frontmatter');
    assert.strictEqual(issues[0]!.kind, 'skill');
  });

  test('flags invalid command YAML as error', () => {
    const results = emptyResults();
    results.commands.push({
      source: 'file',
      label: 'From File',
      commands: [
        {
          itemType: 'command',
          name: 'broken',
          description: '',
          source: 'file',
          path: p('test/fixtures/commands/invalid-yaml/broken.md'),
          error: 'unclosed quote',
        },
      ],
    });
    const issues = checkFrontmatter(results);
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0]!.severity, 'error');
    assert.strictEqual(issues[0]!.kind, 'command');
  });

  test('flags invalid agent YAML as error', () => {
    const results = emptyResults();
    results.agents.global.push({
      itemType: 'agent',
      name: 'broken',
      description: '',
      mode: '',
      source: 'global',
      path: p('test/fixtures/agents/global/broken.md'),
      error: 'unclosed bracket',
    });
    const issues = checkFrontmatter(results);
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0]!.severity, 'error');
    assert.strictEqual(issues[0]!.kind, 'agent');
  });

  test('no issues when everything is valid', () => {
    const issues = checkFrontmatter(emptyResults());
    assert.deepStrictEqual(issues, []);
  });
});

suite('BrokenRefsRule', () => {
  test('flags agent with missing prompt file as error', () => {
    const results = emptyResults();
    results.agents.config.push({
      itemType: 'agent',
      name: 'architect',
      description: '',
      mode: '',
      source: 'config',
      path: p('test/fixtures/agents/config/opencode.json'),
      promptFileRef: path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        'src',
        'test',
        'fixtures',
        'agents',
        'config',
        'prompts',
        'missing.txt',
      ),
    });
    const issues = checkBrokenRefs(results);
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0]!.severity, 'error');
    assert.strictEqual(issues[0]!.rule, 'broken-ref');
    assert.ok(issues[0]!.relatedFile);
  });

  test('no issue for agent whose prompt file exists', () => {
    const results = emptyResults();
    results.agents.config.push({
      itemType: 'agent',
      name: 'architect',
      description: '',
      mode: '',
      source: 'config',
      path: p('test/fixtures/agents/config/opencode.json'),
      promptFile: p('test/fixtures/agents/config/prompts/code-architect.txt'),
      promptFileRef: p('test/fixtures/agents/config/prompts/code-architect.txt'),
    });
    const issues = checkBrokenRefs(results);
    assert.deepStrictEqual(issues, []);
  });

  test('flags MCP server with unavailable command as error', () => {
    const results = emptyResults();
    results.mcp.global.push({
      itemType: 'mcp',
      name: 'ghost',
      type: 'stdio',
      command: 'ho-this-command-does-not-exist-12345',
      enabled: true,
      source: 'global',
      path: p('test/fixtures/health/opencode.json'),
    });
    const issues = checkBrokenRefs(results);
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0]!.severity, 'error');
    assert.strictEqual(issues[0]!.kind, 'mcp');
  });

  test('no issue for MCP server with known command', () => {
    const results = emptyResults();
    results.mcp.global.push({
      itemType: 'mcp',
      name: 'local-tool',
      type: 'stdio',
      command: 'node',
      enabled: true,
      source: 'global',
      path: p('test/fixtures/health/opencode.json'),
    });
    const issues = checkBrokenRefs(results);
    assert.deepStrictEqual(issues, []);
  });
});

suite('commandExists', () => {
  test('returns true for a known binary', () => {
    assert.strictEqual(commandExists('node'), true);
    assert.strictEqual(commandExists('sh'), true);
  });

  test('returns false for a bogus binary', () => {
    assert.strictEqual(commandExists('ho-bogus-binary-99999'), false);
  });
});

suite('DuplicateNamesRule', () => {
  test('flags duplicate skill name across scopes as warning', () => {
    const results = emptyResults();
    results.skills.global.push({
      itemType: 'skill',
      name: 'dup-skill',
      description: 'global',
      path: '/g/skills/dup-skill/SKILL.md',
      enabled: true,
      source: 'global',
    });
    results.skills.local.push({
      itemType: 'skill',
      name: 'dup-skill',
      description: 'local',
      path: '/w/.opencode/skills/dup-skill/SKILL.md',
      enabled: true,
      source: 'local',
    });
    const issues = checkDuplicateNames(results);
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0]!.severity, 'warning');
    assert.strictEqual(issues[0]!.rule, 'duplicate-name');
    assert.ok(issues[0]!.relatedFile);
  });

  test('flags duplicate command name across scopes as warning', () => {
    const results = emptyResults();
    results.commands.push({
      source: 'file',
      label: 'From File',
      commands: [
        {
          itemType: 'command',
          name: 'dup-cmd',
          description: '',
          source: 'file',
          path: '/g/commands/dup-cmd.md',
          scope: 'global',
        },
        {
          itemType: 'command',
          name: 'dup-cmd',
          description: '',
          source: 'file',
          path: '/w/commands/dup-cmd.md',
          scope: 'local',
        },
      ],
    });
    const issues = checkDuplicateNames(results);
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0]!.severity, 'warning');
    assert.strictEqual(issues[0]!.kind, 'command');
  });

  test('no issue when names differ across scopes', () => {
    const results = emptyResults();
    results.skills.global.push({
      itemType: 'skill',
      name: 'only-global',
      description: '',
      path: '/g/skills/only-global/SKILL.md',
      enabled: true,
      source: 'global',
    });
    results.skills.local.push({
      itemType: 'skill',
      name: 'only-local',
      description: '',
      path: '/w/.opencode/skills/only-local/SKILL.md',
      enabled: true,
      source: 'local',
    });
    assert.deepStrictEqual(checkDuplicateNames(results), []);
  });
});

suite('HealthTreeProvider', () => {
  test('groups issues by severity with counts', () => {
    const provider = new HealthTreeProvider();
    provider.setIssues([
      {
        severity: 'error',
        rule: 'frontmatter',
        kind: 'skill',
        message: 'bad yaml',
        file: { fsPath: '/x/SKILL.md' } as never,
      },
      {
        severity: 'error',
        rule: 'broken-ref',
        kind: 'mcp',
        message: 'missing cmd',
        file: { fsPath: '/x/opencode.json' } as never,
      },
      {
        severity: 'warning',
        rule: 'duplicate-name',
        kind: 'skill',
        message: 'dup',
        file: { fsPath: '/y/SKILL.md' } as never,
      },
    ]);
    const root = provider.getChildren();
    assert.strictEqual(root.length, 2);
    assert.deepStrictEqual(severities(root as never[]), ['error', 'warning']);

    const errorNode = root.find((node) => node.type === 'severity' && node.severity === 'error')!;
    const errorChildren = provider.getChildren(errorNode);
    assert.strictEqual(errorChildren.length, 2);

    const warningNode = root.find(
      (node) => node.type === 'severity' && node.severity === 'warning',
    )!;
    const warningChildren = provider.getChildren(warningNode);
    assert.strictEqual(warningChildren.length, 1);
  });

  test('errorCount reflects only errors', () => {
    const provider = new HealthTreeProvider();
    provider.setIssues([
      {
        severity: 'error',
        rule: 'frontmatter',
        kind: 'skill',
        message: 'bad yaml',
        file: { fsPath: '/x/SKILL.md' } as never,
      },
      {
        severity: 'warning',
        rule: 'duplicate-name',
        kind: 'skill',
        message: 'dup',
        file: { fsPath: '/y/SKILL.md' } as never,
      },
    ]);
    assert.strictEqual(provider.errorCount, 1);
  });

  test('severity tree item shows count in label and collapse state', () => {
    const provider = new HealthTreeProvider();
    provider.setIssues([
      {
        severity: 'error',
        rule: 'frontmatter',
        kind: 'skill',
        message: 'bad yaml',
        file: { fsPath: '/x/SKILL.md' } as never,
      },
    ]);
    const errorNode = provider.getChildren().find(
      (node) => node.type === 'severity' && node.severity === 'error',
    )!;
    const treeItem = provider.getTreeItem(errorNode);
    assert.strictEqual(treeItem.label, 'Errors (1)');
    assert.strictEqual(treeItem.contextValue, 'severity');
  });

  test('empty issue set yields empty root and zero errorCount', () => {
    const provider = new HealthTreeProvider();
    provider.setIssues([]);
    assert.deepStrictEqual(provider.getChildren(), []);
    assert.strictEqual(provider.errorCount, 0);
  });

  test('issue tree item carries contextValue issue and icon', () => {
    const provider = new HealthTreeProvider();
    provider.setIssues([
      {
        severity: 'error',
        rule: 'frontmatter',
        kind: 'skill',
        message: 'bad yaml',
        file: { fsPath: '/x/SKILL.md' } as never,
      },
    ]);
    const errorNode = provider.getChildren().find(
      (node) => node.type === 'severity' && node.severity === 'error',
    )!;
    const issueNode = provider.getChildren(errorNode)[0]!;
    const treeItem = provider.getTreeItem(issueNode);
    assert.strictEqual(treeItem.contextValue, 'issue');
    assert.ok(treeItem.iconPath);
  });

  test('refresh fires onDidChangeTreeData', () => {
    const provider = new HealthTreeProvider();
    let fired = false;
    const disposable = provider.onDidChangeTreeData(() => {
      fired = true;
    });
    provider.refresh();
    assert.strictEqual(fired, true);
    disposable.dispose();
  });
});
