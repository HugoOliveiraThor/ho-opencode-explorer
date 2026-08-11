import * as vscode from 'vscode';
import { truncateEnd } from '../util/truncate';
import type { ContentCategory, ContentItemNode, SectionDefinition } from './content';
import type { DetailItem, Skill } from '../types';

export interface SkillsSection {
  section: SectionDefinition<DetailItem>;
  setData(global: Skill[], local: Skill[]): void;
}

export function createSkillsSection(getHiddenPaths: () => string[]): SkillsSection {
  let global: Skill[] = [];
  let local: Skill[] = [];

  const visible = (skills: Skill[]): Skill[] =>
    skills.filter((skill) => !getHiddenPaths().includes(skill.path));

  const toTreeItem = (item: DetailItem): vscode.TreeItem => {
    if (item.itemType !== 'skill') throw new Error('Expected skill item');
    const treeItem = new vscode.TreeItem(item.name);
    treeItem.contextValue = 'skill';
    treeItem.checkboxState = item.enabled
      ? vscode.TreeItemCheckboxState.Checked
      : vscode.TreeItemCheckboxState.Unchecked;
    treeItem.description = item.description ? truncateEnd(item.description, 40) : undefined;
    treeItem.tooltip = item.path;
    if (item.yamlError) {
      treeItem.iconPath = new vscode.ThemeIcon('warning');
    }
    return treeItem;
  };

  const section: SectionDefinition<DetailItem> = {
    key: 'skill',
    label: 'Skills',
    getCategories: (): ContentCategory[] => {
      const categories: ContentCategory[] = [];
      const g = visible(global);
      const l = visible(local);
      if (g.length > 0) {
        categories.push({
          type: 'category',
          sectionKey: 'skill',
          key: 'global',
          label: 'Global Skills',
          count: g.length,
        });
      }
      if (l.length > 0) {
        categories.push({
          type: 'category',
          sectionKey: 'skill',
          key: 'local',
          label: 'Local Skills',
          count: l.length,
        });
      }
      return categories;
    },
    getCategoryChildren: (category): ContentItemNode<DetailItem>[] => {
      const skills = category.key === 'global' ? visible(global) : visible(local);
      return skills.map((skill) => ({ type: 'item', item: skill }));
    },
    toTreeItem,
  };

  return {
    section,
    setData: (g, l) => {
      global = g;
      local = l;
    },
  };
}
