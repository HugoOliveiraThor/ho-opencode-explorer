import * as vscode from 'vscode';
import type { ContentCategory, ContentItemNode, SectionDefinition } from './content';
import type { Agent, DetailItem } from '../types';

export interface AgentsSection {
  section: SectionDefinition<DetailItem>;
  setData(config: Agent[], global: Agent[], local: Agent[]): void;
}

export function createAgentsSection(): AgentsSection {
  let configAgents: Agent[] = [];
  let globalAgents: Agent[] = [];
  let localAgents: Agent[] = [];

  const section: SectionDefinition<DetailItem> = {
    key: 'agent',
    label: 'Agents',
    getCategories: (): ContentCategory[] => {
      const categories: ContentCategory[] = [];
      const add = (key: string, label: string, items: Agent[]) => {
        if (items.length > 0) {
          categories.push({ type: 'category', sectionKey: 'agent', key, label, count: items.length });
        }
      };
      add('config', 'From Config', configAgents);
      add('global', 'Global Agents', globalAgents);
      add('local', 'Local Agents', localAgents);
      return categories;
    },
    getCategoryChildren: (category): ContentItemNode<DetailItem>[] => {
      const agents =
        category.key === 'config'
          ? configAgents
          : category.key === 'global'
            ? globalAgents
            : localAgents;
      return agents.map((agent) => ({ type: 'item', item: agent }));
    },
    toTreeItem: (item: DetailItem): vscode.TreeItem => {
      if (item.itemType !== 'agent') throw new Error('Expected agent item');
      const treeItem = new vscode.TreeItem(item.name);
      treeItem.contextValue = 'agent';
      treeItem.description = item.mode || undefined;
      treeItem.tooltip = item.path;
      treeItem.iconPath = item.error ? new vscode.ThemeIcon('warning') : new vscode.ThemeIcon('account');
      return treeItem;
    },
  };

  return {
    section,
    setData: (c, g, l) => {
      configAgents = c;
      globalAgents = g;
      localAgents = l;
    },
  };
}
