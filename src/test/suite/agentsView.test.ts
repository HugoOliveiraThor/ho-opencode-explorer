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
    const first = children[0]!;
    assert.strictEqual(first.type, 'category');
    if (first.type === 'category') {
      assert.strictEqual(first.label, 'From Config');
    }
    const second = children[1]!;
    if (second.type === 'category') {
      assert.strictEqual(second.label, 'Local Agents');
    }
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
