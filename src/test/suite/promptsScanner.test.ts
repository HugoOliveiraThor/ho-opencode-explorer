import * as assert from 'assert';
import * as path from 'path';
import { PromptsScanner } from '../../scanner/PromptsScanner.js';
import type { PromptItem } from '../../types.js';

suite('PromptsScanner', () => {
  const fixturesDir = path.resolve(__dirname, '..', '..', '..', 'src', 'test', 'fixtures', 'prompts');
  const scanner = new PromptsScanner({
    globalPromptsDir: path.join(fixturesDir, 'global-prompts'),
    globalInstructions: [path.join(fixturesDir, 'global-instructions', 'AGENTS.md')],
    localPromptsDir: '.opencode/prompt',
  });

  test('scans global prompt files', async () => {
    const { global } = await scanner.scanAll(undefined);
    const fixer = global.find((p: PromptItem) => p.name === 'debug-fixer');
    assert.ok(fixer);
    assert.strictEqual(fixer!.kind, 'prompt');
    assert.strictEqual(fixer!.source, 'global');
    assert.ok(fixer!.preview.includes('Debug Fixer'));
  });

  test('scans instruction files as instructions', async () => {
    const { global } = await scanner.scanAll(undefined);
    const agents = global.find((p: PromptItem) => p.name === 'AGENTS.md');
    assert.ok(agents);
    assert.strictEqual(agents!.kind, 'instruction');
  });

  test('scans local prompt files', async () => {
    const { local } = await scanner.scanAll(path.join(fixturesDir, 'local'));
    const note = local.find((p: PromptItem) => p.name === 'local-note');
    assert.ok(note);
    assert.strictEqual(note!.source, 'local');
  });

  test('ignores missing local directory', async () => {
    const scanner2 = new PromptsScanner({
      globalPromptsDir: path.join(fixturesDir, 'global-prompts'),
      globalInstructions: [],
      localPromptsDir: 'nonexistent',
    });
    const { local } = await scanner2.scanAll(path.join(fixturesDir, 'local'));
    assert.deepStrictEqual(local, []);
  });
});
