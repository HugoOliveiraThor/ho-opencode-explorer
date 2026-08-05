import * as assert from 'assert';
import { createSkillsView } from '../../tree/skills';
import type { ContentNode, ContentCategory } from '../../tree/content';
import type { Skill } from '../../types';

function asCategory<T>(node: ContentNode<T> | undefined): ContentCategory {
  if (!node || node.type !== 'category') throw new Error('expected category node');
  return node;
}

suite('createSkillsView', () => {
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

  test('root children are Global and Local category nodes', () => {
    const view = createSkillsView();
    view.setData([globalSkill], [localSkill]);
    const children = view.provider.getChildren();
    assert.strictEqual(children.length, 2);
    assert.strictEqual(asCategory(children[0]).label, 'Global Skills');
    assert.strictEqual(asCategory(children[1]).label, 'Local Skills');
  });

  test('category children return skill items', () => {
    const view = createSkillsView();
    view.setData([globalSkill], []);
    const root = view.provider.getChildren();
    const globalNode = asCategory(root.find((n) => n.type === 'category' && n.label === 'Global Skills'));
    const skills = view.provider.getChildren(globalNode);
    assert.strictEqual(skills.length, 1);
    assert.strictEqual(skills[0]!.type, 'item');
    assert.strictEqual(skills[0]!.item.name, 'test-global');
  });

  test('checkboxState reflects enabled status', () => {
    const view = createSkillsView();
    view.setData([globalSkill], []);
    const root = view.provider.getChildren();
    const globalNode = asCategory(root.find((n) => n.type === 'category' && n.label === 'Global Skills'));
    const skills = view.provider.getChildren(globalNode);
    assert.strictEqual(view.provider.getTreeItem(skills[0]!).checkboxState, 1);
  });

  test('disabled skill has Unchecked checkboxState', () => {
    const view = createSkillsView();
    view.setData([], [localSkill]);
    const root = view.provider.getChildren();
    const localNode = asCategory(root.find((n) => n.type === 'category' && n.label === 'Local Skills'));
    const skills = view.provider.getChildren(localNode);
    assert.strictEqual(view.provider.getTreeItem(skills[0]!).checkboxState, 0);
  });

  test('hides empty categories', () => {
    const view = createSkillsView();
    view.setData([globalSkill], []);
    const root = view.provider.getChildren();
    assert.strictEqual(root.length, 1);
    assert.strictEqual(asCategory(root[0]).label, 'Global Skills');
  });

  test('counts shown in category labels', () => {
    const view = createSkillsView();
    view.setData([globalSkill, globalSkill], []);
    const root = view.provider.getChildren();
    const globalNode = asCategory(root.find((n) => n.type === 'category' && n.label === 'Global Skills'));
    const item = view.provider.getTreeItem(globalNode);
    assert.ok((item.label as string).includes('(2)'));
  });

  test('skill items carry contextValue skill', () => {
    const view = createSkillsView();
    view.setData([globalSkill], []);
    const root = view.provider.getChildren();
    const globalNode = asCategory(root.find((n) => n.type === 'category' && n.label === 'Global Skills'));
    const skills = view.provider.getChildren(globalNode);
    assert.strictEqual(view.provider.getTreeItem(skills[0]!).contextValue, 'skill');
  });
});
