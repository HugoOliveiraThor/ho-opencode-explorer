import * as vscode from 'vscode';
import type { Agent, Command, CommandGroup, McpServer, PromptItem, Skill } from '../types.js';

export type Severity = 'error' | 'warning' | 'info';

export type HealthRule = 'frontmatter' | 'broken-ref' | 'duplicate-name';

export type HealthKind = 'skill' | 'command' | 'agent' | 'mcp' | 'prompt';

export interface HealthIssue {
  severity: Severity;
  rule: HealthRule;
  kind: HealthKind;
  message: string;
  file: vscode.Uri;
  line?: number;
  relatedFile?: vscode.Uri;
}

export interface ScanResults {
  skills: { global: Skill[]; local: Skill[] };
  commands: CommandGroup[];
  agents: { config: Agent[]; global: Agent[]; local: Agent[] };
  mcp: { global: McpServer[]; project: McpServer[] };
  prompts: { global: PromptItem[]; local: PromptItem[] };
}

export type CommandLike = Pick<Command, 'name' | 'scope' | 'path'>;
export type AgentLike = Pick<Agent, 'name' | 'source' | 'path'>;
export type SkillLike = Pick<Skill, 'name' | 'source' | 'path'>;
export type McpLike = Pick<McpServer, 'name' | 'command' | 'path'>;
