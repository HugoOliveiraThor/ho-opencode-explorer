import * as assert from 'assert';
import * as path from 'path';
import { AgentsScanner } from '../../scanner/AgentsScanner.js';
import type { Agent } from '../../types.js';

suite('AgentsScanner', () => {
  const fixturesDir = path.resolve(__dirname, '..', '..', '..', 'src', 'test', 'fixtures', 'agents');
  const scanner = new AgentsScanner({
    configPath: path.join(fixturesDir, 'config', 'opencode.json'),
    globalDir: path.join(fixturesDir, 'global'),
  });

  test('scans config agents with metadata', async () => {
    const { config } = await scanner.scanAll(undefined);
    const architect = config.find((a: Agent) => a.name === 'code-architect');
    assert.ok(architect);
    assert.strictEqual(architect!.mode, 'primary');
    assert.strictEqual(architect!.model, 'opencode/deepseek-v4-pro');
    assert.strictEqual(architect!.source, 'config');
    assert.ok(architect!.jsonPath, 'agent.code-architect');
  });

  test('config agent with empty object still listed', async () => {
    const { config } = await scanner.scanAll(undefined);
    const plan = config.find((a: Agent) => a.name === 'plan');
    assert.ok(plan);
    assert.strictEqual(plan!.description, '');
  });

  test('resolves prompt file reference when present', async () => {
    const { config } = await scanner.scanAll(undefined);
    const architect = config.find((a: Agent) => a.name === 'code-architect');
    assert.ok(architect!.promptFile);
    assert.ok(path.isAbsolute(architect!.promptFile!));
  });

  test('omits promptFile when referenced file missing', async () => {
    const { config } = await scanner.scanAll(undefined);
    const plan = config.find((a: Agent) => a.name === 'plan');
    assert.strictEqual(plan!.promptFile, undefined);
  });

  test('scans global markdown agents', async () => {
    const { global } = await scanner.scanAll(undefined);
    const architect = global.find((a: Agent) => a.name === 'architect');
    assert.ok(architect);
    assert.strictEqual(architect!.mode, 'subagent');
    assert.deepStrictEqual(architect!.tools, ['read', 'edit']);
    assert.strictEqual(architect!.source, 'global');
  });

  test('marks invalid YAML with error', async () => {
    const { global } = await scanner.scanAll(undefined);
    const broken = global.find((a: Agent) => a.name === 'broken');
    assert.ok(broken);
    assert.ok(broken!.error);
  });

  test('returns empty local group without workspace', async () => {
    const { local } = await scanner.scanAll(undefined);
    assert.deepStrictEqual(local, []);
  });
});
