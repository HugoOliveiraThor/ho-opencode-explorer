import * as vscode from 'vscode';
import { ContentTreeDataProvider, type ContentProviderConfig } from './content';
import type { Command, CommandGroup } from '../types';

export interface CommandsView {
  provider: ContentTreeDataProvider<Command>;
  setData(groups: CommandGroup[]): void;
  refresh(): void;
}

export function createCommandsView(): CommandsView {
  let groups: CommandGroup[] = [];

  const config: ContentProviderConfig<Command> = {
    getCategories: () => {
      return groups
        .filter((group) => group.commands.length > 0)
        .map((group) => ({
          type: 'category' as const,
          key: group.source,
          label: group.label,
          count: group.commands.length,
        }));
    },
    getCategoryChildren: (category) => {
      const group = groups.find((g) => g.source === category.key);
      return (group?.commands ?? []).map((command) => ({ type: 'item', item: command }));
    },
    toTreeItem: (command) => {
      const item = new vscode.TreeItem(command.name);
      item.contextValue = 'command';
      item.description = command.description || undefined;
      item.tooltip = command.template || command.description || command.name;
      item.iconPath = command.error
        ? new vscode.ThemeIcon('warning')
        : command.source === 'file'
          ? new vscode.ThemeIcon('file')
          : new vscode.ThemeIcon('json');
      return item;
    },
  };

  const provider = new ContentTreeDataProvider<Command>(config);
  return {
    provider,
    setData: (g) => {
      groups = g;
      provider.refresh();
    },
    refresh: () => provider.refresh(),
  };
}
