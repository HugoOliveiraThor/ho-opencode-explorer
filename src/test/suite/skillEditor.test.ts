import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SkillEditor } from '../../edit/SkillEditor.js';

suite('SkillEditor', () => {
  const editor = new SkillEditor();

  function writeSkill(frontmatter: string, body: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'editor-'));
    const file = path.join(dir, 'SKILL.md');
    fs.writeFileSync(file, `---\n${frontmatter}\n---\n${body}`, 'utf-8');
    return file;
  }

  test('updates all three fields preserving body', () => {
    const file = writeSkill('name: old\ndescription: desc\nenabled: true\n', '\n# Old\n\nBody text.');
    editor.editSkill(file, { name: 'new-name', description: 'New desc', enabled: false });
    const content = fs.readFileSync(file, 'utf-8');
    assert.ok(content.includes('name: new-name'));
    assert.ok(content.includes('description: New desc'));
    assert.ok(content.includes('enabled: false'));
    assert.ok(content.includes('# Old\n\nBody text.'));
  });

  test('creates frontmatter when absent', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'editor-'));
    const file = path.join(dir, 'SKILL.md');
    fs.writeFileSync(file, 'Just a body.', 'utf-8');
    editor.editSkill(file, { name: 'x', description: 'd', enabled: true });
    const content = fs.readFileSync(file, 'utf-8');
    assert.ok(content.startsWith('---'));
    assert.ok(content.includes('name: x'));
  });

  test('throws on invalid YAML frontmatter', () => {
    const file = writeSkill('description: [unclosed\n', '\nBody.');
    assert.throws(() => editor.editSkill(file, { name: 'x', description: 'd', enabled: true }));
    assert.ok(fs.readFileSync(file, 'utf-8').includes('[unclosed'));
  });

  test('writes atomically (temp file does not remain)', () => {
    const file = writeSkill('name: a\n', '\nBody.');
    editor.editSkill(file, { name: 'b', description: 'c', enabled: true });
    const dir = path.dirname(file);
    const leftovers = fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'));
    assert.deepStrictEqual(leftovers, []);
  });
});
