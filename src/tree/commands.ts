import * as vscode from 'vscode';
import { truncateEnd } from '../util/truncate';
import type { ContentCategory, ContentItemNode, SectionDefinition } from './content';
import type { CommandGroup, DetailItem } from '../types';

export interface CommandsSection {
  section: SectionDefinition<DetailItem>;
  setData(groups: CommandGroup[]): void;
}

export function createCommandsSection(): CommandsSection {
  let groups: CommandGroup[] = [];

  const section: SectionDefinition<DetailItem> = {
    key: 'command',
    label: 'Commands',
    getCategories: (): ContentCategory[] =>
      groups
        .filter((group) => group.commands.length > 0)
        .map((group) => ({
          type: 'category',
          sectionKey: 'command',
          key: group.source,
          label: group.label,
          count: group.commands.length,
        })),
    getCategoryChildren: (category): ContentItemNode<DetailItem>[] => {
      const group = groups.find((g) => g.source === category.key);
      return (group?.commands ?? []).map((command) => ({ type: 'item', item: command }));
    },
    toTreeItem: (item: DetailItem): vscode.TreeItem => {
      if (item.itemType !== 'command') throw new Error('Expected command item');
      const treeItem = new vscode.TreeItem(item.name);
      treeItem.contextValue = 'command';
      treeItem.description = item.description ? truncateEnd(item.description, 40) : undefined;
      treeItem.tooltip = item.path || item.template || item.name;
      treeItem.iconPath = item.error
        ? new vscode.ThemeIcon('warning')
        : item.source === 'file'
          ? new vscode.ThemeIcon('file')
          : new vscode.ThemeIcon('json');
      return treeItem;
    },
  };

  return {
    section,
    setData: (g) => {
      groups = g;
    },
  };
}
