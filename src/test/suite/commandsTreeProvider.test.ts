import * as assert from 'assert';
import { createCommandsView } from '../../tree/commands';
import type { ContentNode, ContentCategory } from '../../tree/content';
import type { CommandGroup } from '../../types';

function asCategory<T>(node: ContentNode<T> | undefined): ContentCategory {
  if (!node || node.type !== 'category') throw new Error('expected category node');
  return node;
}

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
    const first = asCategory(children[0]);
    assert.strictEqual(first.type, 'category');
    assert.strictEqual(first.label, 'From File');
    assert.strictEqual(first.count, 1);
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
    const fileCat = asCategory(view.provider.getChildren()[0]);
    const commands = view.provider.getChildren(fileCat);
    assert.strictEqual(commands.length, 1);
    assert.strictEqual(commands[0]!.type, 'item');
    assert.strictEqual(commands[0]!.item.name, 'test-cmd');
  });

  test('getTreeItem returns contextValue command and description', () => {
    const view = createCommandsView();
    view.setData(mockGroups);
    const fileCat = asCategory(view.provider.getChildren()[0]);
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
    const fileCat = asCategory(view.provider.getChildren()[0]);
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
