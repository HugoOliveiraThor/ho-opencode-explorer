import * as fs from 'fs';
import * as path from 'path';
import type { PromptItem, PromptSource, PromptKind } from '../types.js';

interface PromptsScannerOverrides {
  globalPromptsDir: string;
  globalInstructions: string[];
  localPromptsDir: string;
}

export class PromptsScanner {
  private readonly globalPromptsDir: string;
  private readonly globalInstructions: string[];
  private readonly localPromptsDir: string;
  private readonly previewLines = 40;

  constructor(overrides: Partial<PromptsScannerOverrides> = {}) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    this.globalPromptsDir =
      overrides.globalPromptsDir ?? path.join(home, '.config', 'opencode', 'prompts');
    this.globalInstructions =
      overrides.globalInstructions ??
      [
        path.join(home, '.config', 'opencode', 'AGENTS.md'),
        path.join(home, '.config', 'opencode', 'CLAUDE.md'),
      ];
    this.localPromptsDir = overrides.localPromptsDir ?? '.opencode/prompt';
  }

  async scanAll(workspaceRoot?: string): Promise<{ global: PromptItem[]; local: PromptItem[] }> {
    const global = this.scanPromptsDir(this.globalPromptsDir, 'global');
    for (const instructionPath of this.globalInstructions) {
      global.push(...this.scanInstruction(instructionPath, 'global'));
    }

    const local: PromptItem[] = [];
    if (workspaceRoot) {
      local.push(...this.scanPromptsDir(path.join(workspaceRoot, this.localPromptsDir), 'local'));
      for (const name of ['AGENTS.md', 'CLAUDE.md']) {
        local.push(...this.scanInstruction(path.join(workspaceRoot, name), 'local'));
      }
    }

    return { global, local };
  }

  private scanPromptsDir(dirPath: string, source: PromptSource): PromptItem[] {
    if (!fs.existsSync(dirPath)) return [];
    const items: PromptItem[] = [];
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.(txt|md)$/.test(entry.name)) continue;
      const filePath = path.join(dirPath, entry.name);
      const name = entry.name.replace(/\.(txt|md)$/, '');
      items.push(this.makeItem(filePath, name, 'prompt', source));
    }
    return items;
  }

  private scanInstruction(filePath: string, source: PromptSource): PromptItem[] {
    if (!fs.existsSync(filePath)) return [];
    return [this.makeItem(filePath, path.basename(filePath), 'instruction', source)];
  }

  private makeItem(
    filePath: string,
    name: string,
    kind: PromptKind,
    source: PromptSource,
  ): PromptItem {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const preview = content.split('\n').slice(0, this.previewLines).join('\n');
      return { itemType: 'prompt', name, kind, source, path: filePath, preview };
    } catch (err) {
      return {
        itemType: 'prompt',
        name,
        kind,
        source,
        path: filePath,
        preview: '',
        error: err instanceof Error ? err.message : 'Failed to read file',
      };
    }
  }
}
