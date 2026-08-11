import * as vscode from 'vscode';
import type { AgentLike, CommandLike, HealthIssue, ScanResults, SkillLike } from '../types.js';

export function checkDuplicateNames(results: ScanResults): HealthIssue[] {
  const issues: HealthIssue[] = [];

  for (const item of checkDuplicates<SkillLike>(
    'skill',
    results.skills.global,
    results.skills.local,
  )) {
    issues.push(item);
  }

  const globalCommands = results.commands.flatMap((group) =>
    group.commands.filter((c) => c.scope === 'global'),
  );
  const localCommands = results.commands.flatMap((group) =>
    group.commands.filter((c) => c.scope === 'local'),
  );
  for (const item of checkDuplicates<CommandLike>('command', globalCommands, localCommands)) {
    issues.push(item);
  }

  for (const item of checkDuplicates<AgentLike>(
    'agent',
    [...results.agents.global, ...results.agents.config],
    results.agents.local,
  )) {
    issues.push(item);
  }

  return issues;
}

function checkDuplicates<T extends { name: string; path?: string }>(
  kind: HealthIssue['kind'],
  a: T[],
  b: T[],
): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const namesB = new Map(b.map((item) => [item.name, item]));
  for (const itemA of a) {
    const itemB = namesB.get(itemA.name);
    if (!itemB) continue;
    if (!itemA.path || !itemB.path) continue;
    issues.push({
      severity: 'warning',
      rule: 'duplicate-name',
      kind,
      message: `Duplicate ${kind} name "${itemA.name}" in global and local scope`,
      file: vscode.Uri.file(itemA.path),
      relatedFile: vscode.Uri.file(itemB.path),
    });
  }
  return issues;
}
