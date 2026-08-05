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
