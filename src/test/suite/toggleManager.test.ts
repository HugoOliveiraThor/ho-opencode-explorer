import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { SkillToggleManager } from '../../toggle/SkillToggleManager';

suite('SkillToggleManager', () => {
  let tmpDir: string;
  let skillFile: string;
  let manager: SkillToggleManager;

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toggle-test-'));
    skillFile = path.join(tmpDir, 'SKILL.md');
    manager = new SkillToggleManager();
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('toggles enabled from true to false', () => {
    fs.writeFileSync(
      skillFile,
      '---\nname: test\ndescription: desc\nenabled: true\n---\n\n# Content\n',
    );
    manager.toggle(skillFile);
    const content = fs.readFileSync(skillFile, 'utf-8');
    assert.ok(content.includes('enabled: false'));
  });

  test('toggles enabled from false to true', () => {
    fs.writeFileSync(skillFile, '---\nname: test\nenabled: false\n---\n\n# Content\n');
    manager.toggle(skillFile);
    const content = fs.readFileSync(skillFile, 'utf-8');
    assert.ok(content.includes('enabled: true'));
  });

  test('adds enabled field when missing from frontmatter', () => {
    fs.writeFileSync(skillFile, '---\nname: test\n---\n\n# Content\n');
    manager.toggle(skillFile);
    const content = fs.readFileSync(skillFile, 'utf-8');
    assert.ok(content.includes('enabled: false'));
  });

  test('adds enabled field when no frontmatter exists', () => {
    fs.writeFileSync(skillFile, '# No frontmatter\n\nJust content.\n');
    manager.toggle(skillFile);
    const content = fs.readFileSync(skillFile, 'utf-8');
    assert.ok(content.includes('enabled: false'));
    assert.ok(content.startsWith('---\n'));
  });

  test('reads enabled state from file', () => {
    fs.writeFileSync(skillFile, '---\nname: test\nenabled: false\n---\n\n# Content\n');
    const enabled = manager.isEnabled(skillFile);
    assert.strictEqual(enabled, false);
  });

  test('returns true when reading file without enabled field', () => {
    fs.writeFileSync(skillFile, '---\nname: test\n---\n\n# Content\n');
    const enabled = manager.isEnabled(skillFile);
    assert.strictEqual(enabled, true);
  });
});
