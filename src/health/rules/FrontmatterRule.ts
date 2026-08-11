import * as vscode from 'vscode';
import type { HealthIssue, ScanResults } from '../types.js';

export function checkFrontmatter(results: ScanResults): HealthIssue[] {
  const issues: HealthIssue[] = [];

  for (const skill of [...results.skills.global, ...results.skills.local]) {
    if (skill.yamlError) {
      issues.push({
        severity: 'error',
        rule: 'frontmatter',
        kind: 'skill',
        message: `Invalid YAML frontmatter: ${skill.yamlError}`,
        file: vscode.Uri.file(skill.path),
      });
    }
  }

  for (const group of results.commands) {
    for (const command of group.commands) {
      if (command.error && command.path) {
        issues.push({
          severity: 'error',
          rule: 'frontmatter',
          kind: 'command',
          message: `Invalid YAML frontmatter: ${command.error}`,
          file: vscode.Uri.file(command.path),
        });
      }
    }
  }

  for (const agent of [...results.agents.config, ...results.agents.global, ...results.agents.local]) {
    if (agent.error) {
      issues.push({
        severity: 'error',
        rule: 'frontmatter',
        kind: 'agent',
        message: `Invalid YAML/JSON: ${agent.error}`,
        file: vscode.Uri.file(agent.path),
      });
    }
  }

  for (const prompt of [...results.prompts.global, ...results.prompts.local]) {
    if (prompt.error) {
      issues.push({
        severity: 'warning',
        rule: 'frontmatter',
        kind: 'prompt',
        message: `Failed to read prompt: ${prompt.error}`,
        file: vscode.Uri.file(prompt.path),
      });
    }
  }

  return issues;
}
