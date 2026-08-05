import * as vscode from 'vscode';
import { ContentTreeDataProvider, type ContentCategory, type ContentProviderConfig } from './content';
import type { Skill } from '../types';

export interface SkillsView {
  provider: ContentTreeDataProvider<Skill>;
  setData(global: Skill[], local: Skill[]): void;
  refresh(): void;
}

export function createSkillsView(): SkillsView {
  let global: Skill[] = [];
  let local: Skill[] = [];

  const config: ContentProviderConfig<Skill> = {
    getCategories: () => {
      const categories: ContentCategory[] = [];
      if (global.length > 0) {
        categories.push({
          type: 'category',
          key: 'global',
          label: 'Global Skills',
          count: global.length,
        });
      }
      if (local.length > 0) {
        categories.push({
          type: 'category',
          key: 'local',
          label: 'Local Skills',
          count: local.length,
        });
      }
      return categories;
    },
    getCategoryChildren: (category) => {
      const skills = category.key === 'global' ? global : local;
      return skills.map((skill) => ({ type: 'item', item: skill }));
    },
    toTreeItem: (skill) => {
      const item = new vscode.TreeItem(skill.name);
      item.contextValue = 'skill';
      item.checkboxState = skill.enabled
        ? vscode.TreeItemCheckboxState.Checked
        : vscode.TreeItemCheckboxState.Unchecked;
      item.description = skill.path;
      item.tooltip = skill.description || skill.name;
      if (skill.yamlError) {
        item.iconPath = new vscode.ThemeIcon('warning');
      }
      return item;
    },
  };

  const provider = new ContentTreeDataProvider<Skill>(config);
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
