import * as vscode from 'vscode';
import { ContentTreeDataProvider, type ContentCategory, type ContentProviderConfig } from './content';
import type { Agent } from '../types';

export interface AgentsView {
  provider: ContentTreeDataProvider<Agent>;
  setData(config: Agent[], global: Agent[], local: Agent[]): void;
  refresh(): void;
}

export function createAgentsView(): AgentsView {
  let configAgents: Agent[] = [];
  let globalAgents: Agent[] = [];
  let localAgents: Agent[] = [];

  const config: ContentProviderConfig<Agent> = {
    getCategories: () => {
      const categories: ContentCategory[] = [];
      if (configAgents.length > 0) {
        categories.push({
          type: 'category',
          key: 'config',
          label: 'From Config',
          count: configAgents.length,
        });
      }
      if (globalAgents.length > 0) {
        categories.push({
          type: 'category',
          key: 'global',
          label: 'Global Agents',
          count: globalAgents.length,
        });
      }
      if (localAgents.length > 0) {
        categories.push({
          type: 'category',
          key: 'local',
          label: 'Local Agents',
          count: localAgents.length,
        });
      }
      return categories;
    },
    getCategoryChildren: (category) => {
      const agents =
        category.key === 'config'
          ? configAgents
          : category.key === 'global'
            ? globalAgents
            : localAgents;
      return agents.map((agent) => ({ type: 'item', item: agent }));
    },
    toTreeItem: (agent) => {
      const item = new vscode.TreeItem(agent.name);
      item.contextValue = 'agent';
      item.description = agent.mode || undefined;
      item.tooltip = agent.description || agent.name;
      item.iconPath = agent.error ? new vscode.ThemeIcon('warning') : new vscode.ThemeIcon('account');
      return item;
    },
  };

  const provider = new ContentTreeDataProvider<Agent>(config);
  return {
    provider,
    setData: (c, g, l) => {
      configAgents = c;
      globalAgents = g;
      localAgents = l;
      provider.refresh();
    },
    refresh: () => provider.refresh(),
  };
}
