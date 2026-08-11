import { ContentTreeDataProvider, type ContentProviderConfig } from './content';
import { createSkillsSection } from './skills';
import { createCommandsSection } from './commands';
import { createAgentsSection } from './agents';
import { createMcpSection } from './mcp';
import { createPromptsSection } from './prompts';
import type { Agent, CommandGroup, DetailItem, McpServer, PromptItem, Skill } from '../types';

export interface ExplorerView {
  provider: ContentTreeDataProvider<DetailItem>;
  setSkills(global: Skill[], local: Skill[]): void;
  setCommands(groups: CommandGroup[]): void;
  setAgents(config: Agent[], global: Agent[], local: Agent[]): void;
  setMcp(global: McpServer[], project: McpServer[]): void;
  setPrompts(global: PromptItem[], local: PromptItem[]): void;
  refresh(): void;
}

export function createExplorerView(getHiddenPaths: () => string[]): ExplorerView {
  const skills = createSkillsSection(getHiddenPaths);
  const commands = createCommandsSection();
  const agents = createAgentsSection();
  const mcp = createMcpSection();
  const prompts = createPromptsSection();

  const config: ContentProviderConfig<DetailItem> = {
    getSections: () => [
      skills.section,
      commands.section,
      agents.section,
      mcp.section,
      prompts.section,
    ],
  };

  const provider = new ContentTreeDataProvider<DetailItem>(config);

  return {
    provider,
    setSkills: (g, l) => {
      skills.setData(g, l);
      provider.refresh();
    },
    setCommands: (groups) => {
      commands.setData(groups);
      provider.refresh();
    },
    setAgents: (c, g, l) => {
      agents.setData(c, g, l);
      provider.refresh();
    },
    setMcp: (g, p) => {
      mcp.setData(g, p);
      provider.refresh();
    },
    setPrompts: (g, l) => {
      prompts.setData(g, l);
      provider.refresh();
    },
    refresh: () => provider.refresh(),
  };
}
