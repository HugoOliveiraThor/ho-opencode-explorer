import * as assert from 'assert';
import { createPromptsView } from '../../tree/prompts';
import type { PromptItem } from '../../types';

suite('createPromptsView', () => {
  const globalPrompt: PromptItem = {
    itemType: 'prompt',
    name: 'debug-fixer',
    kind: 'prompt',
    source: 'global',
    path: '/home/user/.config/opencode/prompts/debug-fixer.txt',
    preview: 'You are Debug Fixer.',
  };
  const localInstruction: PromptItem = {
    itemType: 'prompt',
    name: 'AGENTS.md',
    kind: 'instruction',
    source: 'local',
    path: '/ws/AGENTS.md',
    preview: '# Instructions',
  };

  test('root categories from prompts and instructions', () => {
    const view = createPromptsView();
    view.setData([globalPrompt], [localInstruction]);
    const children = view.provider.getChildren();
    assert.strictEqual(children.length, 2);
    const first = children[0]!;
    if (first.type === 'category') {
      assert.strictEqual(first.label, 'Prompts — Global');
    }
    const second = children[1]!;
    if (second.type === 'category') {
      assert.strictEqual(second.label, 'Instructions — Local');
    }
  });

  test('prompt items use file-text icon, instructions use book', () => {
    const view = createPromptsView();
    view.setData([globalPrompt], [localInstruction]);
    const promptCat = view.provider.getChildren()[0]!;
    const instructionCat = view.provider.getChildren()[1]!;
    const promptIcon = view.provider.getTreeItem(view.provider.getChildren(promptCat)[0]!).iconPath;
    const instructionIcon = view.provider.getTreeItem(
      view.provider.getChildren(instructionCat)[0]!,
    ).iconPath;
    assert.ok(promptIcon);
    assert.ok(instructionIcon);
    assert.notStrictEqual(JSON.stringify(promptIcon), JSON.stringify(instructionIcon));
  });

  test('item contextValue is prompt', () => {
    const view = createPromptsView();
    view.setData([globalPrompt], []);
    const promptCat = view.provider.getChildren()[0]!;
    const item = view.provider.getChildren(promptCat)[0]!;
    assert.strictEqual(view.provider.getTreeItem(item).contextValue, 'prompt');
  });
});
