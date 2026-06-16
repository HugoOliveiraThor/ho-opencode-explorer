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
