import * as assert from 'assert';
import * as path from 'path';
import { CommandsScanner } from '../../scanner/CommandsScanner.js';

suite('CommandsScanner', () => {
  const fixturesDir = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'src',
    'test',
    'fixtures',
    'commands',
  );
  const scanner = new CommandsScanner();

  test('scans .md files in a directory and returns commands', () => {
    const validDir = path.join(fixturesDir, 'valid-command');
    const commands = scanner.scanCommandsDir(validDir, 'file');
    assert.ok(commands.length >= 1);
    const cmd = commands[0]!;
    assert.strictEqual(cmd.name, 'my-command');
    assert.strictEqual(cmd.description, 'A test command for unit tests');
    assert.strictEqual(cmd.source, 'file');
    assert.ok(cmd.path);
    assert.ok(cmd.template);
    assert.ok(cmd.template!.includes('Run the full test suite'));
  });

  test('handles .md file without frontmatter', () => {
    const dir = path.join(fixturesDir, 'no-frontmatter');
    const commands = scanner.scanCommandsDir(dir, 'file');
    assert.ok(commands.length >= 1);
    const cmd = commands[0]!;
    assert.strictEqual(cmd.name, 'no-desc');
    assert.strictEqual(cmd.description, '');
    assert.strictEqual(cmd.source, 'file');
    assert.strictEqual(cmd.error, undefined);
  });

  test('handles .md file with invalid YAML frontmatter', () => {
    const dir = path.join(fixturesDir, 'invalid-yaml');
    const commands = scanner.scanCommandsDir(dir, 'file');
    assert.ok(commands.length >= 1);
    const cmd = commands[0]!;
    assert.strictEqual(cmd.name, 'broken');
    assert.ok(cmd.error);
  });

  test('returns empty array for non-existent directory', () => {
    const commands = scanner.scanCommandsDir('/tmp/nonexistent-dir-for-test', 'file');
    assert.strictEqual(commands.length, 0);
  });

  test('extracts frontmatter from markdown', () => {
    const content = '---\ndescription: hello\n---\nbody here';
    const fm = scanner.extractFrontmatter(content);
    assert.strictEqual(fm, 'description: hello');
  });

  test('returns null for content without frontmatter', () => {
    const content = 'just raw content';
    const fm = scanner.extractFrontmatter(content);
    assert.strictEqual(fm, null);
  });

  test('scanAll returns both file and json groups', async () => {
    const groups = await scanner.scanAll();
    assert.strictEqual(groups.length, 2);
    assert.strictEqual(groups[0]!.source, 'file');
    assert.strictEqual(groups[0]!.label, 'From File');
    assert.strictEqual(groups[1]!.source, 'json');
    assert.strictEqual(groups[1]!.label, 'From opencode.json');
  });

  test('scans opencode.json commands from fixture', async () => {
    const jsonPath = path.join(fixturesDir, 'opencode-json', 'opencode.json');
    const content = {
      command: {
        'gsd-new-project': {
          description: 'Inicie um projeto do zero',
          template: 'Execute o comando /gsd-new-project do GSD.',
        },
      },
    };
    const commands = Object.entries(content.command).map(([name, entry]) => ({
      name,
      description: entry.description || '',
      source: 'json' as const,
      path: jsonPath,
      template: entry.template,
      jsonPath: `command.${name}`,
    }));
    assert.strictEqual(commands.length, 1);
    assert.strictEqual(commands[0]!.name, 'gsd-new-project');
    assert.strictEqual(commands[0]!.description, 'Inicie um projeto do zero');
    assert.strictEqual(commands[0]!.jsonPath, 'command.gsd-new-project');
  });
});
