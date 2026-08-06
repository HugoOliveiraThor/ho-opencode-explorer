import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ContentMover } from '../../move/ContentMover';

suite('ContentMover', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mover-'));
  const ws = path.join(tmp, 'workspace');
  const globalSkills = path.join(tmp, 'global-skills');
  const localSkills = path.join(tmp, 'local-skills');
  const globalCommands = path.join(tmp, 'global-commands');
  const localCommands = path.join(tmp, 'local-commands');
  const mover = new ContentMover({
    globalSkillsDir: globalSkills,
    localSkillsDir: localSkills,
    globalCommandsDir: globalCommands,
    localCommandsDir: localCommands,
  });

  test('moves a skill directory from global to local', () => {
    fs.mkdirSync(path.join(globalSkills, 'alpha', 'SKILL.md'), { recursive: true });
    const from = path.join(globalSkills, 'alpha');
    const dest = mover.moveSkill(from, 'global', ws);
    assert.strictEqual(dest, path.join(localSkills, 'alpha'));
    assert.ok(fs.existsSync(path.join(localSkills, 'alpha', 'SKILL.md')));
    assert.ok(!fs.existsSync(from));
  });

  test('moves a skill from local to global', () => {
    fs.mkdirSync(path.join(localSkills, 'beta', 'SKILL.md'), { recursive: true });
    const from = path.join(localSkills, 'beta');
    const dest = mover.moveSkill(from, 'local', ws);
    assert.strictEqual(dest, path.join(globalSkills, 'beta'));
    assert.ok(fs.existsSync(path.join(globalSkills, 'beta', 'SKILL.md')));
  });

  test('moves a command file', () => {
    fs.writeFileSync(
      path.join(globalCommands, 'gamma.md'),
      '---\ndescription: x\n---\n',
      'utf-8',
    );
    const from = path.join(globalCommands, 'gamma.md');
    const dest = mover.moveCommand(from, 'global', ws);
    assert.strictEqual(dest, path.join(localCommands, 'gamma.md'));
    assert.ok(fs.existsSync(path.join(localCommands, 'gamma.md')));
  });

  test('rejects when target already exists', () => {
    fs.mkdirSync(path.join(globalSkills, 'dup'), { recursive: true });
    fs.mkdirSync(path.join(localSkills, 'dup'), { recursive: true });
    assert.throws(() => mover.moveSkill(path.join(globalSkills, 'dup'), 'global', ws));
  });

  test('throws when local target has no workspace', () => {
    assert.throws(() => mover.moveSkill(path.join(globalSkills, 'alpha'), 'global', undefined));
  });
});
