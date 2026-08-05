import * as vscode from 'vscode';
import type { Command, CommandGroup } from '../types';

type CommandTreeNode = CommandCategoryNode | CommandNode;

interface CommandCategoryNode {
  type: 'category';
  label: string;
  source: 'file' | 'json';
  count: number;
}

interface CommandNode {
  type: 'command';
  label: string;
  command: Command;
}

export class CommandsTreeDataProvider implements vscode.TreeDataProvider<CommandTreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CommandTreeNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private groups: CommandGroup[] = [];

  setGroups(groups: CommandGroup[]): void {
    this.groups = groups;
    this._onDidChangeTreeData.fire();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CommandTreeNode): vscode.TreeItem {
    if (element.type === 'category') {
      const item = new vscode.TreeItem(
        `${element.label} (${element.count})`,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.contextValue = 'commandCategory';
      return item;
    }

    const item = new vscode.TreeItem(element.command.name);
    item.contextValue = 'command';
    item.description = element.command.description || undefined;
    item.tooltip = element.command.template || element.command.description || element.command.name;
    if (element.command.error) {
      item.iconPath = new vscode.ThemeIcon('warning');
    } else {
      item.iconPath =
        element.command.source === 'file'
          ? new vscode.ThemeIcon('file')
          : new vscode.ThemeIcon('json');
    }
    return item;
  }

  getChildren(element?: CommandTreeNode): CommandTreeNode[] {
    if (!element) {
      return this.groups
        .filter((g) => g.commands.length > 0)
        .map((g) => ({
          type: 'category' as const,
          label: g.label,
          source: g.source,
          count: g.commands.length,
        }));
    }

    if (element.type === 'category') {
      const group = this.groups.find((g) => g.source === element.source);
      if (!group) return [];
      return group.commands.map((cmd) => ({
        type: 'command' as const,
        label: cmd.name,
        command: cmd,
      }));
    }

    return [];
  }
}
