export type SkillSource = 'global' | 'local';

export interface Skill {
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
  name: string;
  description: string;
  source: CommandSource;
  path?: string;
  template?: string;
  jsonPath?: string;
  error?: string;
}

export interface CommandGroup {
  source: CommandSource;
  label: string;
  commands: Command[];
}
