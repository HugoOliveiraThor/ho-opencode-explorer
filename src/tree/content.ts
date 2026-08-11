import * as vscode from 'vscode';

export interface ContentSection {
  type: 'section';
  key: string;
  label: string;
}

export interface ContentCategory {
  type: 'category';
  sectionKey: string;
  key: string;
  label: string;
  count: number;
}

export interface ContentItemNode<T> {
  type: 'item';
  item: T;
}

export type ContentNode<T> = ContentSection | ContentCategory | ContentItemNode<T>;

export interface SectionDefinition<T> {
  key: string;
  label: string;
  getCategories: () => ContentCategory[];
  getCategoryChildren: (category: ContentCategory) => ContentItemNode<T>[];
  toTreeItem: (item: T) => vscode.TreeItem;
}

export interface ContentProviderConfig<T> {
  getSections: () => SectionDefinition<T>[];
}

export class ContentTreeDataProvider<T> implements vscode.TreeDataProvider<ContentNode<T>> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ContentNode<T> | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly config: ContentProviderConfig<T>) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ContentNode<T>): vscode.TreeItem {
    if (element.type === 'section') {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
      item.contextValue = 'section';
      return item;
    }
    if (element.type === 'category') {
      const item = new vscode.TreeItem(
        `${element.label} (${element.count})`,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.contextValue = 'category';
      return item;
    }
    const section = this.sectionForItem(element.item);
    return section.toTreeItem(element.item);
  }

  getChildren(element?: ContentNode<T>): ContentNode<T>[] {
    if (!element) {
      return this.config
        .getSections()
        .filter((section) => section.getCategories().length > 0)
        .map((section) => ({ type: 'section', key: section.key, label: section.label }));
    }
    if (element.type === 'section') {
      return this.sectionByKey(element.key)?.getCategories() ?? [];
    }
    if (element.type === 'category') {
      return this.sectionByKey(element.sectionKey)?.getCategoryChildren(element) ?? [];
    }
    return [];
  }

  private sectionByKey(key: string): SectionDefinition<T> | undefined {
    return this.config.getSections().find((section) => section.key === key);
  }

  private sectionForItem(item: T): SectionDefinition<T> {
    const itemType = (item as { itemType: string }).itemType;
    const section = this.sectionByKey(itemType);
    if (!section) throw new Error(`No section registered for item type "${itemType}"`);
    return section;
  }
}
