import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ContentCreator } from '../../create/ContentCreator';

suite('ContentCreator', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-'));
  const creator = new ContentCreator({
    globalSkillsDir: path.join(tmp, 'skills'),
    localSkillsDir: 'skills',
    globalCommandsDir: path.join(tmp, 'commands'),
    localCommandsDir: 'commands',
  });

  test('scaffolds a skill directory with frontmatter', () => {
    const filePath = creator.scaffoldSkill(path.join(tmp, 'skills'), 'My Skill');
    assert.ok(fs.existsSync(filePath));
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('name: my-skill'));
    assert.ok(content.includes('enabled: true'));
    assert.ok(content.includes('description: ""'));
  });

  test('rejects duplicate skill names', () => {
    assert.throws(() => creator.scaffoldSkill(path.join(tmp, 'skills'), 'My Skill'));
  });

  test('rejects invalid skill names', () => {
    assert.throws(() => creator.scaffoldSkill(path.join(tmp, 'skills'), 'a/b'));
    assert.throws(() => creator.scaffoldSkill(path.join(tmp, 'skills'), ''));
  });

  test('scaffolds a command file', () => {
    const filePath = creator.scaffoldCommand(path.join(tmp, 'commands'), 'My Command');
    assert.ok(fs.existsSync(filePath));
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('description: ""'));
    assert.ok(path.basename(filePath), 'my-command.md');
  });
});
