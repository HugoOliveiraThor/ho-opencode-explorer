export type SkillSource = 'global' | 'local';

export interface Skill {
  itemType: 'skill';
  name: string;
  description: string;
  path: string;
  enabled: boolean;
  source: SkillSource;
  yamlError?: string;
}

export interface SkillGroup {
  source: SkillSource;
  skills: Skill[];
}

export type CommandSource = 'file' | 'json';

export interface Command {
  itemType: 'command';
  name: string;
  description: string;
  source: CommandSource;
  path?: string;
  template?: string;
  jsonPath?: string;
  scope?: 'global' | 'local';
  error?: string;
}

export interface CommandGroup {
  source: CommandSource;
  label: string;
  commands: Command[];
}

export type ExplorerItemType = 'skill' | 'command' | 'agent' | 'mcp' | 'prompt';

export type AgentSource = 'config' | 'global' | 'local';

export interface Agent {
  itemType: 'agent';
  name: string;
  description: string;
  mode: string;
  model?: string;
  temperature?: number;
  promptFile?: string;
  tools?: string[];
  source: AgentSource;
  path: string;
  jsonPath?: string;
  error?: string;
}

export type McpSource = 'global' | 'project';

export interface McpServer {
  itemType: 'mcp';
  name: string;
  type: string;
  url?: string;
  command?: string;
  args?: string[];
  enabled: boolean;
  source: McpSource;
  path: string;
  jsonPath?: string;
  error?: string;
}

export type PromptKind = 'prompt' | 'instruction';
export type PromptSource = 'global' | 'local';

export interface PromptItem {
  itemType: 'prompt';
  name: string;
  kind: PromptKind;
  source: PromptSource;
  path: string;
  preview: string;
  error?: string;
}

export type DetailItem = Skill | Command | Agent | McpServer | PromptItem;
