import * as vscode from 'vscode';
import { ContentTreeDataProvider, type ContentCategory, type ContentProviderConfig } from './content';
import type { McpServer } from '../types';

export interface McpView {
  provider: ContentTreeDataProvider<McpServer>;
  setData(global: McpServer[], project: McpServer[]): void;
  refresh(): void;
}

export function createMcpView(): McpView {
  let global: McpServer[] = [];
  let project: McpServer[] = [];

  const config: ContentProviderConfig<McpServer> = {
    getCategories: () => {
      const categories: ContentCategory[] = [];
      if (global.length > 0) {
        categories.push({
          type: 'category',
          key: 'global',
          label: 'Global',
          count: global.length,
        });
      }
      if (project.length > 0) {
        categories.push({
          type: 'category',
          key: 'project',
          label: 'Project',
          count: project.length,
        });
      }
      return categories;
    },
    getCategoryChildren: (category) => {
      const servers = category.key === 'global' ? global : project;
      return servers.map((server) => ({ type: 'item', item: server }));
    },
    toTreeItem: (server) => {
      const item = new vscode.TreeItem(server.name);
      item.contextValue = 'mcp';
      item.description = server.enabled ? 'enabled' : 'disabled';
      item.tooltip = server.url ?? server.command ?? server.name;
      item.iconPath = server.error ? new vscode.ThemeIcon('warning') : new vscode.ThemeIcon('plug');
      return item;
    },
  };

  const provider = new ContentTreeDataProvider<McpServer>(config);
  return {
    provider,
    setData: (g, p) => {
      global = g;
      project = p;
      provider.refresh();
    },
    refresh: () => provider.refresh(),
  };
}
