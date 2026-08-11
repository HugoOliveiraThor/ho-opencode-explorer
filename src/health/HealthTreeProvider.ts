import * as vscode from 'vscode';
import type { HealthIssue, Severity } from './types.js';

export type HealthNode = SeverityNode | IssueNode;

export interface SeverityNode {
  type: 'severity';
  severity: Severity;
  label: string;
}

export interface IssueNode {
  type: 'issue';
  issue: HealthIssue;
}

const SEVERITY_LABELS: Record<Severity, string> = {
  error: 'Errors',
  warning: 'Warnings',
  info: 'Info',
};

const SEVERITY_ORDER: Severity[] = ['error', 'warning', 'info'];

export class HealthTreeProvider implements vscode.TreeDataProvider<HealthNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<HealthNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private issues: HealthIssue[] = [];

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setIssues(issues: HealthIssue[]): void {
    this.issues = issues;
    this.refresh();
  }

  get errorCount(): number {
    return this.issues.filter((issue) => issue.severity === 'error').length;
  }

  getTreeItem(element: HealthNode): vscode.TreeItem {
    if (element.type === 'severity') {
      const count = this.issues.filter((issue) => issue.severity === element.severity).length;
      const item = new vscode.TreeItem(
        `${element.label} (${count})`,
        count > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
      );
      item.contextValue = 'severity';
      return item;
    }

    const issue = element.issue;
    const item = new vscode.TreeItem(issue.message);
    item.contextValue = 'issue';
    item.tooltip = issue.message;
    item.description = issue.file.fsPath;
    item.iconPath = new vscode.ThemeIcon(
      issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info',
    );
    return item;
  }

  getChildren(element?: HealthNode): HealthNode[] {
    if (!element) {
      return SEVERITY_ORDER.filter(
        (severity) => this.issues.some((issue) => issue.severity === severity),
      ).map((severity) => ({ type: 'severity', severity, label: SEVERITY_LABELS[severity] }));
    }
    if (element.type === 'severity') {
      return this.issues
        .filter((issue) => issue.severity === element.severity)
        .map((issue) => ({ type: 'issue', issue }));
    }
    return [];
  }
}
