import * as fs from 'fs';
import * as path from 'path';
import type { McpServer, McpSource } from '../types.js';

interface McpScannerOverrides {
  configPath: string;
  localMcpPath: string;
}

interface McpEntry {
  type?: unknown;
  url?: unknown;
  command?: unknown;
  args?: unknown;
  enabled?: unknown;
}

export class McpScanner {
  private readonly configPath: string;
  private readonly localMcpPath: string;

  constructor(overrides: Partial<McpScannerOverrides> = {}) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    this.configPath = overrides.configPath ?? path.join(home, '.config', 'opencode', 'opencode.json');
    this.localMcpPath = overrides.localMcpPath ?? '.mcp.json';
  }

  async scanAll(
    workspaceRoot?: string,
  ): Promise<{ global: McpServer[]; project: McpServer[] }> {
    return {
      global: this.scanConfig(),
      project: workspaceRoot ? this.scanLocal(path.join(workspaceRoot, this.localMcpPath)) : [],
    };
  }

  private scanConfig(): McpServer[] {
    if (!fs.existsSync(this.configPath)) return [];
    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(content) as { mcp?: Record<string, McpEntry> };
      return this.toServers(config.mcp ?? {}, 'global', this.configPath, 'mcp');
    } catch (err) {
      return [
        {
          itemType: 'mcp',
          name: 'opencode.json',
          type: 'unknown',
          enabled: false,
          source: 'global',
          path: this.configPath,
          error: err instanceof Error ? err.message : 'Failed to parse opencode.json',
        },
      ];
    }
  }

  private scanLocal(filePath: string): McpServer[] {
    if (!fs.existsSync(filePath)) return [];
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const config = JSON.parse(content) as {
        servers?: Record<string, McpEntry>;
        mcp?: Record<string, McpEntry>;
      };
      const section = config.servers ?? config.mcp ?? {};
      return this.toServers(section, 'project', filePath, 'servers');
    } catch (err) {
      return [
        {
          itemType: 'mcp',
          name: path.basename(filePath),
          type: 'unknown',
          enabled: false,
          source: 'project',
          path: filePath,
          error: err instanceof Error ? err.message : 'Failed to parse .mcp.json',
        },
      ];
    }
  }

  private toServers(
    entries: Record<string, McpEntry>,
    source: McpSource,
    pathValue: string,
    prefix: string,
  ): McpServer[] {
    return Object.entries(entries).map(([name, entry]) => ({
      itemType: 'mcp',
      name,
      type: typeof entry.type === 'string' ? entry.type : 'unknown',
      url: typeof entry.url === 'string' ? entry.url : undefined,
      command: typeof entry.command === 'string' ? entry.command : undefined,
      args: Array.isArray(entry.args)
        ? entry.args.filter((a): a is string => typeof a === 'string')
        : undefined,
      enabled: entry.enabled !== false,
      source,
      path: pathValue,
      jsonPath: `${prefix}.${name}`,
    }));
  }
}
