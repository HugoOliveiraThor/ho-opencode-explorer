import * as vscode from 'vscode';

export interface ContentCategory {
  type: 'category';
  key: string;
  label: string;
  count: number;
}

export interface ContentItemNode<T> {
  type: 'item';
  item: T;
}

export type ContentNode<T> = ContentCategory | ContentItemNode<T>;

export interface ContentProviderConfig<T> {
  getCategories: () => ContentCategory[];
  getCategoryChildren: (category: ContentCategory) => ContentItemNode<T>[];
  toTreeItem: (item: T) => vscode.TreeItem;
}

export class ContentTreeDataProvider<T> implements vscode.TreeDataProvider<ContentNode<T>> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ContentNode<T> | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly config: ContentProviderConfig<T>) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ContentNode<T>): vscode.TreeItem {
    if (element.type === 'category') {
      const item = new vscode.TreeItem(
        `${element.label} (${element.count})`,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.contextValue = 'category';
      return item;
    }
    return this.config.toTreeItem(element.item);
  }

  getChildren(element?: ContentNode<T>): ContentNode<T>[] {
    if (!element) {
      return this.config.getCategories();
    }
    if (element.type === 'category') {
      return this.config.getCategoryChildren(element);
    }
    return [];
  }
}
