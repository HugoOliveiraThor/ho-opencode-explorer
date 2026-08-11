import * as vscode from 'vscode';
import type { ContentCategory, ContentItemNode, SectionDefinition } from './content';
import type { DetailItem, McpServer } from '../types';

export interface McpSection {
  section: SectionDefinition<DetailItem>;
  setData(global: McpServer[], project: McpServer[]): void;
}

export function createMcpSection(): McpSection {
  let global: McpServer[] = [];
  let project: McpServer[] = [];

  const section: SectionDefinition<DetailItem> = {
    key: 'mcp',
    label: 'MCP Servers',
    getCategories: (): ContentCategory[] => {
      const categories: ContentCategory[] = [];
      if (global.length > 0) {
        categories.push({
          type: 'category',
          sectionKey: 'mcp',
          key: 'global',
          label: 'Global',
          count: global.length,
        });
      }
      if (project.length > 0) {
        categories.push({
          type: 'category',
          sectionKey: 'mcp',
          key: 'project',
          label: 'Project',
          count: project.length,
        });
      }
      return categories;
    },
    getCategoryChildren: (category): ContentItemNode<DetailItem>[] => {
      const servers = category.key === 'global' ? global : project;
      return servers.map((server) => ({ type: 'item', item: server }));
    },
    toTreeItem: (item: DetailItem): vscode.TreeItem => {
      if (item.itemType !== 'mcp') throw new Error('Expected mcp item');
      const treeItem = new vscode.TreeItem(item.name);
      treeItem.contextValue = 'mcp';
      treeItem.description = item.enabled ? 'enabled' : 'disabled';
      treeItem.tooltip = item.path || item.url || item.command || item.name;
      treeItem.iconPath = item.error ? new vscode.ThemeIcon('warning') : new vscode.ThemeIcon('plug');
      return treeItem;
    },
  };

  return {
    section,
    setData: (g, p) => {
      global = g;
      project = p;
    },
  };
}
