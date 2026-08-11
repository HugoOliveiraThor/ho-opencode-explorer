import * as vscode from 'vscode';
import type { ContentCategory, ContentItemNode, SectionDefinition } from './content';
import type { DetailItem, PromptItem } from '../types';

export interface PromptsSection {
  section: SectionDefinition<DetailItem>;
  setData(global: PromptItem[], local: PromptItem[]): void;
}

export function createPromptsSection(): PromptsSection {
  let global: PromptItem[] = [];
  let local: PromptItem[] = [];

  const section: SectionDefinition<DetailItem> = {
    key: 'prompt',
    label: 'Prompts & Instructions',
    getCategories: (): ContentCategory[] => {
      const categories: ContentCategory[] = [];
      const add = (key: string, label: string, items: PromptItem[]) => {
        if (items.length > 0) {
          categories.push({ type: 'category', sectionKey: 'prompt', key, label, count: items.length });
        }
      };
      add('prompt-global', 'Prompts — Global', global.filter((i) => i.kind === 'prompt'));
      add('prompt-local', 'Prompts — Local', local.filter((i) => i.kind === 'prompt'));
      add('instruction-global', 'Instructions — Global', global.filter((i) => i.kind === 'instruction'));
      add('instruction-local', 'Instructions — Local', local.filter((i) => i.kind === 'instruction'));
      return categories;
    },
    getCategoryChildren: (category): ContentItemNode<DetailItem>[] => {
      const source = category.key.endsWith('-global') ? global : local;
      const kind = category.key.startsWith('prompt') ? 'prompt' : 'instruction';
      return source
        .filter((i) => i.kind === kind)
        .map((item) => ({ type: 'item', item }));
    },
    toTreeItem: (item: DetailItem): vscode.TreeItem => {
      if (item.itemType !== 'prompt') throw new Error('Expected prompt item');
      const treeItem = new vscode.TreeItem(item.name);
      treeItem.contextValue = 'prompt';
      treeItem.description = item.source;
      treeItem.tooltip = item.path;
      treeItem.iconPath =
        item.kind === 'instruction' ? new vscode.ThemeIcon('book') : new vscode.ThemeIcon('file-text');
      return treeItem;
    },
  };

  return {
    section,
    setData: (g, l) => {
      global = g;
      local = l;
    },
  };
}
