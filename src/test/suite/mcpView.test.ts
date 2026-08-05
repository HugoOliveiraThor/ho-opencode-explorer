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
    const first = children[0]!;
    if (first.type === 'category') {
      assert.strictEqual(first.label, 'Global');
    }
    const second = children[1]!;
    if (second.type === 'category') {
      assert.strictEqual(second.label, 'Project');
    }
  });

  test('item description reflects enabled status', () => {
    const view = createMcpView();
    view.setData([global], [project]);
    const root = view.provider.getChildren();
    const globalCat = root[0]!;
    const globalItems = view.provider.getChildren(globalCat);
    assert.strictEqual(view.provider.getTreeItem(globalItems[0]!).description, 'enabled');
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
