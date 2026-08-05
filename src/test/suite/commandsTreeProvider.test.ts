import * as assert from 'assert';
import { CommandsTreeDataProvider } from '../../tree/CommandsTreeDataProvider.js';
import type { CommandGroup } from '../../types.js';

suite('CommandsTreeDataProvider', () => {
  const provider = new CommandsTreeDataProvider();

  const mockGroups: CommandGroup[] = [
    {
      source: 'file',
      label: 'From File',
      commands: [
        {
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

  test('returns categories as root children', () => {
    provider.setGroups(mockGroups);
    const children = provider.getChildren();
    assert.strictEqual(children.length, 2);
    assert.strictEqual(children[0]!.type, 'category');
    assert.strictEqual(children[0]!.label, 'From File');
    assert.strictEqual(children[0]!.count, 1);
    assert.strictEqual(children[1]!.type, 'category');
    assert.strictEqual(children[1]!.label, 'From opencode.json');
    assert.strictEqual(children[1]!.count, 1);
  });

  test('hides empty groups', () => {
    const groups: CommandGroup[] = [
      { source: 'file', label: 'From File', commands: [] },
      { source: 'json', label: 'From opencode.json', commands: [] },
    ];
    provider.setGroups(groups);
    const children = provider.getChildren();
    assert.strictEqual(children.length, 0);
  });

  test('category children are command nodes', () => {
    provider.setGroups(mockGroups);
    const root = provider.getChildren();
    const fileCat = root[0]!;
    assert.strictEqual(fileCat.type, 'category');
    const commands = provider.getChildren(fileCat);
    assert.strictEqual(commands.length, 1);
    assert.strictEqual(commands[0]!.type, 'command');
    assert.strictEqual(commands[0]!.label, 'test-cmd');
  });

  test('getTreeItem returns TreeItem with contextValue for command', () => {
    provider.setGroups(mockGroups);
    const root = provider.getChildren();
    const fileCat = root[0]!;
    const commands = provider.getChildren(fileCat);
    const item = provider.getTreeItem(commands[0]!);
    assert.strictEqual(item.contextValue, 'command');
    assert.strictEqual(item.description, 'A test command');
  });

  test('getTreeItem returns TreeItem with warning icon for errored command', () => {
    const groups: CommandGroup[] = [
      {
        source: 'file',
        label: 'From File',
        commands: [
          {
            name: 'broken',
            description: '',
            source: 'file',
            path: '/tmp/broken.md',
            error: 'YAML parse error',
          },
        ],
      },
    ];
    provider.setGroups(groups);
    const root = provider.getChildren();
    const cat = root[0]!;
    const commands = provider.getChildren(cat);
    const item = provider.getTreeItem(commands[0]!);
    assert.ok(item.iconPath);
  });

  test('json command has jsonPath set', () => {
    provider.setGroups(mockGroups);
    const root = provider.getChildren();
    const jsonCat = root[1]!;
    assert.strictEqual(jsonCat.type, 'category');
    assert.strictEqual(jsonCat.label, 'From opencode.json');
    const commands = provider.getChildren(jsonCat);
    const cmd = commands[0]!;
    assert.strictEqual(cmd.type, 'command');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.strictEqual((cmd as any).command.jsonPath, 'command.inline-cmd');
  });

  test('refresh fires onDidChangeTreeData', () => {
    let fired = false;
    const disposable = provider.onDidChangeTreeData(() => {
      fired = true;
    });
    provider.refresh();
    assert.strictEqual(fired, true);
    disposable.dispose();
  });

  test('getChildren returns empty for non-existing category', () => {
    provider.setGroups([]);
    const children = provider.getChildren({
      type: 'category',
      label: 'Nonexistent',
      source: 'file',
      count: 0,
    });
    assert.strictEqual(children.length, 0);
  });
});
