import * as vscode from 'vscode';
import { ContentTreeDataProvider, type ContentCategory, type ContentProviderConfig } from './content';
import type { PromptItem } from '../types';

export interface PromptsView {
  provider: ContentTreeDataProvider<PromptItem>;
  setData(global: PromptItem[], local: PromptItem[]): void;
  refresh(): void;
}

export function createPromptsView(): PromptsView {
  let global: PromptItem[] = [];
  let local: PromptItem[] = [];

  const config: ContentProviderConfig<PromptItem> = {
    getCategories: () => {
      const categories: ContentCategory[] = [];
      const add = (key: string, label: string, items: PromptItem[]) => {
        if (items.length > 0) {
          categories.push({ type: 'category', key, label, count: items.length });
        }
      };
      add('prompt-global', 'Prompts — Global', global.filter((i) => i.kind === 'prompt'));
      add('prompt-local', 'Prompts — Local', local.filter((i) => i.kind === 'prompt'));
      add('instruction-global', 'Instructions — Global', global.filter((i) => i.kind === 'instruction'));
      add('instruction-local', 'Instructions — Local', local.filter((i) => i.kind === 'instruction'));
      return categories;
    },
    getCategoryChildren: (category) => {
      const source = category.key.endsWith('-global') ? global : local;
      const kind = category.key.startsWith('prompt') ? 'prompt' : 'instruction';
      return source
        .filter((i) => i.kind === kind)
        .map((item) => ({ type: 'item', item }));
    },
    toTreeItem: (item) => {
      const treeItem = new vscode.TreeItem(item.name);
      treeItem.contextValue = 'prompt';
      treeItem.description = item.source;
      treeItem.iconPath =
        item.kind === 'instruction' ? new vscode.ThemeIcon('book') : new vscode.ThemeIcon('file-text');
      return treeItem;
    },
  };

  const provider = new ContentTreeDataProvider<PromptItem>(config);
  return {
    provider,
    setData: (g, l) => {
      global = g;
      local = l;
      provider.refresh();
    },
    refresh: () => provider.refresh(),
  };
}
