import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { extractFrontmatter } from './frontmatter.js';
import type { Agent, AgentSource } from '../types.js';

interface AgentsScannerOverrides {
  configPath: string;
  globalDir: string;
  localDir: string;
}

interface AgentEntry {
  description?: unknown;
  mode?: unknown;
  model?: unknown;
  temperature?: unknown;
  prompt?: unknown;
  tools?: unknown;
}

export class AgentsScanner {
  private readonly configPath: string;
  private readonly globalDir: string;
  private readonly localDir: string;

  constructor(overrides: Partial<AgentsScannerOverrides> = {}) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    this.configPath = overrides.configPath ?? path.join(home, '.config', 'opencode', 'opencode.json');
    this.globalDir = overrides.globalDir ?? path.join(home, '.config', 'opencode', 'agent');
    this.localDir = overrides.localDir ?? '.opencode/agent';
  }

  async scanAll(
    workspaceRoot?: string,
  ): Promise<{ config: Agent[]; global: Agent[]; local: Agent[] }> {
    return {
      config: this.scanConfigAgents(),
      global: this.scanMarkdownAgents(this.globalDir, 'global'),
      local: workspaceRoot
        ? this.scanMarkdownAgents(path.join(workspaceRoot, this.localDir), 'local')
        : [],
    };
  }

  scanMarkdownAgents(dirPath: string, source: AgentSource): Agent[] {
    if (!fs.existsSync(dirPath)) return [];
    const agents: Agent[] = [];
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const filePath = path.join(dirPath, entry.name);
      const baseName = entry.name.replace(/\.md$/, '');
      const content = fs.readFileSync(filePath, 'utf-8');
      try {
        const frontmatter = extractFrontmatter(content);
        const parsed = frontmatter
          ? (YAML.parse(frontmatter) as {
              name?: string;
              description?: string;
              mode?: string;
              model?: string;
              tools?: unknown;
            })
          : {};
        agents.push({
          itemType: 'agent',
          name: parsed.name || baseName,
          description: parsed.description || '',
          mode: parsed.mode || '',
          model: parsed.model,
          tools: this.asStringArray(parsed.tools),
          source,
          path: filePath,
        });
      } catch (err) {
        agents.push({
          itemType: 'agent',
          name: baseName,
          description: '',
          mode: '',
          source,
          path: filePath,
          error: err instanceof Error ? err.message : 'Invalid YAML',
        });
      }
    }
    return agents;
  }

  private scanConfigAgents(): Agent[] {
    if (!fs.existsSync(this.configPath)) return [];
    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(content) as { agent?: Record<string, AgentEntry> };
      const agents = config.agent ?? {};
      return Object.entries(agents).map(([name, entry]) => ({
        itemType: 'agent' as const,
        name,
        description: typeof entry.description === 'string' ? entry.description : '',
        mode: typeof entry.mode === 'string' ? entry.mode : '',
        model: typeof entry.model === 'string' ? entry.model : undefined,
        temperature: typeof entry.temperature === 'number' ? entry.temperature : undefined,
        promptFile: this.resolvePromptFile(entry.prompt),
        tools: this.asStringArray(entry.tools),
        source: 'config' as const,
        path: this.configPath,
        jsonPath: `agent.${name}`,
      }));
    } catch (err) {
      return [
        {
          itemType: 'agent',
          name: 'opencode.json',
          description: '',
          mode: '',
          source: 'config',
          path: this.configPath,
          error: err instanceof Error ? err.message : 'Failed to parse opencode.json',
        },
      ];
    }
  }

  private resolvePromptFile(prompt: unknown): string | undefined {
    let ref: string | undefined;
    if (typeof prompt === 'string') {
      ref = prompt;
    } else if (prompt && typeof prompt === 'object' && 'file' in prompt) {
      const file = (prompt as { file?: unknown }).file;
      if (typeof file === 'string') ref = file;
    }
    if (!ref) return undefined;
    const resolved = path.resolve(path.dirname(this.configPath), ref);
    return fs.existsSync(resolved) ? resolved : undefined;
  }

  private asStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const strings = value.filter((v): v is string => typeof v === 'string');
    return strings.length > 0 ? strings : undefined;
  }
}
