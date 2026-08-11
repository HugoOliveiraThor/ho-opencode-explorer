import * as assert from 'assert';
import { createExplorerView } from '../../tree/sections';
import type { ContentCategory, ContentNode, ContentSection } from '../../tree/content';
import type {
  Agent,
  Command,
  CommandGroup,
  DetailItem,
  McpServer,
  PromptItem,
  Skill,
} from '../../types';

function asSection(node: ContentNode<DetailItem> | undefined): ContentSection {
  if (!node || node.type !== 'section') throw new Error('expected section node');
  return node;
}

function asCategory(node: ContentNode<DetailItem> | undefined): ContentCategory {
  if (!node || node.type !== 'category') throw new Error('expected category node');
  return node;
}

function asItem(node: ContentNode<DetailItem> | undefined): ContentItem {
  if (!node || node.type !== 'item') throw new Error('expected item node');
  return node;
}

type ContentItem = { type: 'item'; item: DetailItem };

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
const hiddenSkill: Skill = {
  itemType: 'skill',
  name: 'hidden-one',
  description: '',
  path: '/home/user/.config/opencode/skills/hidden-one/SKILL.md',
  enabled: true,
  source: 'global',
};
const command: Command = {
  itemType: 'command',
  name: 'test-cmd',
  description: 'A test command',
  source: 'file',
  path: '/home/user/.config/opencode/commands/test-cmd.md',
  template: 'echo hello',
};
const commandGroups: CommandGroup[] = [
  { source: 'file', label: 'From File', commands: [command] },
];
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
const mcpGlobal: McpServer = {
  itemType: 'mcp',
  name: 'ai-memory',
  type: 'remote',
  url: 'http://127.0.0.1:49374/mcp',
  enabled: true,
  source: 'global',
  path: '/home/user/.config/opencode/opencode.json',
  jsonPath: 'mcp.ai-memory',
};
const globalPrompt: PromptItem = {
  itemType: 'prompt',
  name: 'debug-fixer',
  kind: 'prompt',
  source: 'global',
  path: '/home/user/.config/opencode/prompts/debug-fixer.txt',
  preview: 'You are Debug Fixer.',
};

function noHidden(): string[] {
  return [];
}

suite('createExplorerView', () => {
  test('root children are the five sections', () => {
    const view = createExplorerView(noHidden);
    view.setSkills([globalSkill], [localSkill]);
    view.setCommands(commandGroups);
    view.setAgents([configAgent], [], []);
    view.setMcp([mcpGlobal], []);
    view.setPrompts([globalPrompt], []);
    const root = view.provider.getChildren();
    assert.strictEqual(root.length, 5);
    assert.strictEqual(asSection(root[0]).label, 'Skills');
    assert.strictEqual(asSection(root[1]).label, 'Commands');
    assert.strictEqual(asSection(root[2]).label, 'Agents');
    assert.strictEqual(asSection(root[3]).label, 'MCP Servers');
    assert.strictEqual(asSection(root[4]).label, 'Prompts & Instructions');
  });

  test('empty sections are hidden from root', () => {
    const view = createExplorerView(noHidden);
    view.setSkills([], []);
    const root = view.provider.getChildren();
    assert.strictEqual(root.length, 0);
  });

  test('section children are categories, category children are items', () => {
    const view = createExplorerView(noHidden);
    view.setSkills([globalSkill], [localSkill]);
    const root = view.provider.getChildren();
    const skillsSection = asSection(root[0]);
    const categories = view.provider.getChildren(skillsSection);
    assert.strictEqual(categories.length, 2);
    assert.strictEqual(asCategory(categories[0]).label, 'Global Skills');
    const items = view.provider.getChildren(asCategory(categories[0]));
    assert.strictEqual(items.length, 1);
    assert.strictEqual(asItem(items[0]).item.name, 'test-global');
  });

  test('section and category tree items carry contextValue', () => {
    const view = createExplorerView(noHidden);
    view.setSkills([globalSkill], []);
    const root = view.provider.getChildren();
    const section = asSection(root[0]);
    const sectionTree = view.provider.getTreeItem(section);
    assert.strictEqual(sectionTree.contextValue, 'section');
    const category = asCategory(view.provider.getChildren(section)[0]);
    const categoryTree = view.provider.getTreeItem(category);
    assert.strictEqual(categoryTree.contextValue, 'category');
  });

  test('skill item has checkbox, contextValue skill, truncated description', () => {
    const view = createExplorerView(noHidden);
    view.setSkills([globalSkill], []);
    const root = view.provider.getChildren();
    const cat = asCategory(view.provider.getChildren(asSection(root[0]))[0]);
    const item = asItem(view.provider.getChildren(cat)[0]);
    const treeItem = view.provider.getTreeItem(item);
    assert.strictEqual(treeItem.checkboxState, 1);
    assert.strictEqual(treeItem.contextValue, 'skill');
    assert.ok((treeItem.tooltip as string).includes('.config/opencode/skills'));
  });

  test('non-skill items have no checkbox', () => {
    const view = createExplorerView(noHidden);
    view.setCommands(commandGroups);
    const root = view.provider.getChildren();
    const cat = asCategory(view.provider.getChildren(asSection(root[0]))[0]);
    const item = asItem(view.provider.getChildren(cat)[0]);
    assert.strictEqual(view.provider.getTreeItem(item).checkboxState, undefined);
  });

  test('hidden skills are filtered from categories and counts', () => {
    const view = createExplorerView(() => [hiddenSkill.path]);
    view.setSkills([globalSkill, hiddenSkill], []);
    const root = view.provider.getChildren();
    const cat = asCategory(view.provider.getChildren(asSection(root[0]))[0]);
    assert.strictEqual(cat.count, 1);
    const items = view.provider.getChildren(cat);
    assert.strictEqual(items.length, 1);
    assert.strictEqual(asItem(items[0]).item.name, 'test-global');
  });

  test('hidden-skills change is reflected after setData + refresh', () => {
    let hidden: string[] = [];
    const view = createExplorerView(() => hidden);
    view.setSkills([globalSkill], []);
    hidden = [globalSkill.path];
    view.setSkills([globalSkill], []);
    const root = view.provider.getChildren();
    assert.strictEqual(root.length, 0);
  });

  test('getTreeItem routes each item type to its own section factory', () => {
    const view = createExplorerView(noHidden);
    view.setSkills([globalSkill], []);
    view.setCommands(commandGroups);
    view.setAgents([configAgent], [], []);
    view.setMcp([mcpGlobal], []);
    view.setPrompts([globalPrompt], []);
    const root = view.provider.getChildren();
    for (const section of root) {
      const categories = view.provider.getChildren(section);
      for (const category of categories) {
        for (const item of view.provider.getChildren(category)) {
          const treeItem = view.provider.getTreeItem(item);
          assert.ok(treeItem.label);
        }
      }
    }
  });

  test('refresh fires onDidChangeTreeData', () => {
    const view = createExplorerView(noHidden);
    let fired = false;
    const disposable = view.provider.onDidChangeTreeData(() => {
      fired = true;
    });
    view.refresh();
    assert.strictEqual(fired, true);
    disposable.dispose();
  });
});
