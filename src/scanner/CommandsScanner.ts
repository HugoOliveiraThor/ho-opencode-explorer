import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import type { Command, CommandSource, CommandGroup } from '../types.js';

interface CommandFrontmatter {
  description?: string;
}

export class CommandsScanner {
  private readonly globalCommandsDir: string;
  private readonly localCommandsDir: string;
  private readonly globalConfigPath: string;

  constructor() {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    this.globalCommandsDir = path.join(home, '.config', 'opencode', 'commands');
    this.localCommandsDir = '.opencode/commands';
    this.globalConfigPath = path.join(home, '.config', 'opencode', 'opencode.json');
  }

  async scanAll(workspaceRoot?: string): Promise<CommandGroup[]> {
    const groups: CommandGroup[] = [];

    const fileCommands = await this.scanFileCommands(workspaceRoot);
    groups.push({
      source: 'file',
      label: 'From File',
      commands: fileCommands,
    });

    const jsonCommands = await this.scanJsonCommands();
    groups.push({
      source: 'json',
      label: 'From opencode.json',
      commands: jsonCommands,
    });

    return groups;
  }

  private async scanFileCommands(workspaceRoot?: string): Promise<Command[]> {
    const commands: Command[] = [];

    if (fs.existsSync(this.globalCommandsDir)) {
      commands.push(...this.scanCommandsDir(this.globalCommandsDir, 'file'));
    }

    if (workspaceRoot) {
      const localDir = path.join(workspaceRoot, this.localCommandsDir);
      if (fs.existsSync(localDir)) {
        commands.push(...this.scanCommandsDir(localDir, 'file'));
      }
    }

    return commands;
  }

  scanCommandsDir(dirPath: string, source: CommandSource): Command[] {
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    const commands: Command[] = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

      const filePath = path.join(dirPath, entry.name);
      const name = entry.name.replace(/\.md$/, '');
      const content = fs.readFileSync(filePath, 'utf-8');

      try {
        const frontmatter = this.extractFrontmatter(content);
        if (frontmatter) {
          const parsed = YAML.parse(frontmatter) as CommandFrontmatter;
          const body = this.extractBody(content);
          commands.push({
            name,
            description: parsed.description || '',
            source,
            path: filePath,
            template: body || undefined,
          });
        } else {
          commands.push({
            name,
            description: '',
            source,
            path: filePath,
            template: content.trim() || undefined,
          });
        }
      } catch (err) {
        commands.push({
          name,
          description: '',
          source,
          path: filePath,
          error: err instanceof Error ? err.message : 'Unknown YAML error',
        });
      }
    }

    return commands;
  }

  private async scanJsonCommands(): Promise<Command[]> {
    if (!fs.existsSync(this.globalConfigPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.globalConfigPath, 'utf-8');
      const config = JSON.parse(content) as Record<string, unknown>;
      const commandsSection = config.command as
        | Record<string, { description?: string; template?: string }>
        | undefined;

      if (!commandsSection) return [];

      return Object.entries(commandsSection).map(([name, entry]) => ({
        name,
        description: entry.description || '',
        source: 'json' as const,
        path: this.globalConfigPath,
        template: entry.template,
        jsonPath: `command.${name}`,
      }));
    } catch {
      return [];
    }
  }

  extractFrontmatter(content: string): string | null {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    return match ? match[1]! : null;
  }

  private extractBody(content: string): string {
    const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
    return match ? match[1]!.trim() : '';
  }
}
