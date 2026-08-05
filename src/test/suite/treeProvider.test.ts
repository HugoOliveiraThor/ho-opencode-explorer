import * as assert from 'assert';
import { SkillTreeDataProvider } from '../../tree/SkillTreeDataProvider';
import type { Skill } from '../../types';

suite('SkillTreeDataProvider', () => {
  const globalSkill: Skill = {
    itemType: 'skill',
    name: 'test-global',
    description: 'A global skill',
    path: '/home/user/.config/opencode/skills/test-global/SKILL.md',
    enabled: true,
    source: 'global',
  };

  const localSkill: Skill = {
    itemType: 'skill',
    name: 'test-local',
    description: 'A local skill',
    path: '/workspace/.opencode/skills/test-local/SKILL.md',
    enabled: false,
    source: 'local',
  };

  const provider = new SkillTreeDataProvider();

  test('getChildren on root returns Global and Local category nodes', () => {
    provider.setSkills([globalSkill], [localSkill]);
    const children = provider.getChildren();
    assert.strictEqual(children.length, 2);
    assert.strictEqual(children[0]!.label, 'Global Skills');
    assert.strictEqual(children[1]!.label, 'Local Skills');
  });

  test('getChildren on Global node returns skill items', () => {
    provider.setSkills([globalSkill], []);
    const root = provider.getChildren();
    const globalNode = root.find((n) => n.label === 'Global Skills');
    const skills = provider.getChildren(globalNode);
    assert.strictEqual(skills.length, 1);
    assert.strictEqual(skills[0]!.label, 'test-global');
  });

  test('checkboxState reflects enabled status', () => {
    provider.setSkills([globalSkill], [localSkill]);
    const root = provider.getChildren();
    const globalNode = root.find((n) => n.label === 'Global Skills');
    const skills = provider.getChildren(globalNode);
    const enabledSkill = skills.find((s) => s.label === 'test-global')!;
    assert.strictEqual(enabledSkill.type, 'skill');
    assert.strictEqual(provider.getTreeItem(enabledSkill).checkboxState, 1);
  });

  test('disabled skill has Unchecked checkboxState', () => {
    provider.setSkills([], [localSkill]);
    const root = provider.getChildren();
    const localNode = root.find((n) => n.label === 'Local Skills');
    const skills = provider.getChildren(localNode);
    assert.strictEqual(provider.getTreeItem(skills[0]!).checkboxState, 0);
  });

  test('hides Local Skills section when no local skills', () => {
    provider.setSkills([globalSkill], []);
    const root = provider.getChildren();
    assert.strictEqual(root.length, 1);
    assert.strictEqual(root[0]!.label, 'Global Skills');
  });

  test('hides Global Skills section when no global skills', () => {
    provider.setSkills([], [localSkill]);
    const root = provider.getChildren();
    assert.strictEqual(root.length, 1);
    assert.strictEqual(root[0]!.label, 'Local Skills');
  });

  test('counts shown in category labels', () => {
    provider.setSkills([globalSkill, globalSkill], [localSkill]);
    const root = provider.getChildren();
    const globalNode = root.find((n) => n.label === 'Global Skills');
    const item = provider.getTreeItem(globalNode!);
    assert.ok((item.label as string).includes('(2)'));
  });
});
