import * as assert from 'assert';
import * as path from 'path';
import * as os from 'os';
import { SkillsScanner } from '../../scanner/SkillsScanner.js';
import type { Skill } from '../../types.js';

suite('SkillsScanner', () => {
  const fixturesDir = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'src',
    'test',
    'fixtures',
    'skills',
  );
  const scanner = new SkillsScanner();

  test('detects skill directory containing SKILL.md', () => {
    const dir = path.join(fixturesDir, 'valid-skill');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasSkill = (scanner as any).hasSkillFile(dir);
    assert.strictEqual(hasSkill, true);
  });

  test('returns false for directory without SKILL.md', () => {
    const dir = os.tmpdir();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasSkill = (scanner as any).hasSkillFile(dir);
    assert.strictEqual(hasSkill, false);
  });

  test('parses valid SKILL.md with frontmatter', () => {
    const filePath = path.join(fixturesDir, 'valid-skill', 'SKILL.md');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skill = (scanner as any).parseSkillFile(filePath, 'global');
    assert.strictEqual(skill.name, 'test-skill');
    assert.strictEqual(skill.description, 'A test skill for unit tests');
    assert.strictEqual(skill.enabled, true);
    assert.strictEqual(skill.source, 'global');
    assert.strictEqual(skill.path, filePath);
  });

  test('handles SKILL.md without frontmatter', () => {
    const filePath = path.join(fixturesDir, 'no-frontmatter', 'SKILL.md');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skill = (scanner as any).parseSkillFile(filePath, 'local');
    assert.strictEqual(skill.enabled, true);
    assert.ok(skill.name.length > 0);
  });

  test('handles SKILL.md with invalid YAML', () => {
    const filePath = path.join(fixturesDir, 'invalid-yaml', 'SKILL.md');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skill = (scanner as any).parseSkillFile(filePath, 'global');
    assert.ok(skill.yamlError);
    assert.strictEqual(skill.enabled, false);
  });

  test('scans a directory and returns skills', async () => {
    const skills = await scanner.scanDirectory(fixturesDir, 'global');
    assert.ok(skills.length >= 3);
    const valid = skills.find((s: Skill) => s.name === 'test-skill');
    assert.ok(valid);
    assert.strictEqual(valid!.enabled, true);
  });
});
