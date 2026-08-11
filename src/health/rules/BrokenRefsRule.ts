import * as fs from 'fs';
import * as vscode from 'vscode';
import type { HealthIssue, ScanResults } from '../types.js';

export function checkBrokenRefs(results: ScanResults): HealthIssue[] {
  const issues: HealthIssue[] = [];

  for (const agent of results.agents.config) {
    if (agent.promptFileRef && !agent.promptFile) {
      issues.push({
        severity: 'error',
        rule: 'broken-ref',
        kind: 'agent',
        message: `Agent "${agent.name}" references missing prompt file: ${agent.promptFileRef}`,
        file: vscode.Uri.file(agent.path),
        relatedFile: vscode.Uri.file(agent.promptFileRef),
      });
    }
  }

  for (const server of [...results.mcp.global, ...results.mcp.project]) {
    if (server.command && !commandExists(server.command)) {
      issues.push({
        severity: 'error',
        rule: 'broken-ref',
        kind: 'mcp',
        message: `MCP server "${server.name}" uses unavailable command: ${server.command}`,
        file: vscode.Uri.file(server.path),
      });
    }
  }

  return issues;
}

export function commandExists(command: string): boolean {
  const cmd = command.split(' ')[0];
  if (!cmd) return false;
  const candidates =
    process.platform === 'win32'
      ? [cmd, `${cmd}.exe`, `${cmd}.cmd`, `${cmd}.bat`]
      : [cmd];
  for (const candidate of candidates) {
    if (isAbsolutePath(candidate) || candidate.includes('/')) {
      if (fs.existsSync(candidate)) return true;
      continue;
    }
    const pathDirs = (process.env.PATH ?? '').split(':').filter(Boolean);
    for (const dir of pathDirs) {
      if (fs.existsSync(`${dir}/${candidate}`)) return true;
    }
  }
  return false;
}

function isAbsolutePath(value: string): boolean {
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value);
}
