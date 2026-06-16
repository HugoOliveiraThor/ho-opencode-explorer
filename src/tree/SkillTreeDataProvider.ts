import * as vscode from 'vscode';
import type { Skill } from '../types';

type TreeNode = CategoryNode | SkillNode;

interface CategoryNode {
  type: 'category';
  label: string;
  source: 'global' | 'local';
}

interface SkillNode {
  type: 'skill';
  label: string;
  skill: Skill;
}

export class SkillTreeDataProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private globalSkills: Skill[] = [];
  private localSkills: Skill[] = [];

  setSkills(global: Skill[], local: Skill[]): void {
    this.globalSkills = global;
    this.localSkills = local;
    this._onDidChangeTreeData.fire();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    if (element.type === 'category') {
      const count =
        element.source === 'global' ? this.globalSkills.length : this.localSkills.length;
      const item = new vscode.TreeItem(
        `${element.label} (${count})`,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.contextValue = 'category';
      return item;
    }

    const item = new vscode.TreeItem(element.skill.name);
    item.contextValue = 'skill';
    item.checkboxState = element.skill.enabled
      ? vscode.TreeItemCheckboxState.Checked
      : vscode.TreeItemCheckboxState.Unchecked;
    item.description = element.skill.path;
    item.tooltip = element.skill.description || element.skill.name;
    if (element.skill.yamlError) {
      item.iconPath = new vscode.ThemeIcon('warning');
    }
    return item;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      const categories: TreeNode[] = [];
      if (this.globalSkills.length > 0) {
        categories.push({
          type: 'category',
          label: 'Global Skills',
          source: 'global',
        });
      }
      if (this.localSkills.length > 0) {
        categories.push({
          type: 'category',
          label: 'Local Skills',
          source: 'local',
        });
      }
      return categories;
    }

    if (element.type === 'category') {
      const skills = element.source === 'global' ? this.globalSkills : this.localSkills;
      return skills.map((skill) => ({
        type: 'skill' as const,
        label: skill.name,
        skill,
      }));
    }

    return [];
  }
}
