import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { assertSafeName, resolveWithin } from '../util/safePaths';

interface ContentCreatorRoots {
  globalSkillsDir: string;
  localSkillsDir: string;
  globalCommandsDir: string;
  localCommandsDir: string;
}

const SKILL_TEMPLATE = (name: string): string =>
  `---\nname: ${name}\ndescription: ""\nenabled: true\n---\n\n# ${name}\n\nDescribe what this skill does.\n`;

const COMMAND_TEMPLATE = '---\ndescription: ""\n---\n\nDescribe what this command does.\n';

export class ContentCreator {
  private readonly globalSkillsDir: string;
  private readonly localSkillsDir: string;
  private readonly globalCommandsDir: string;
  private readonly localCommandsDir: string;

  constructor(overrides: Partial<ContentCreatorRoots> = {}) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    this.globalSkillsDir =
      overrides.globalSkillsDir ?? path.join(home, '.config', 'opencode', 'skills');
    this.localSkillsDir = overrides.localSkillsDir ?? '.opencode/skills';
    this.globalCommandsDir =
      overrides.globalCommandsDir ?? path.join(home, '.config', 'opencode', 'commands');
    this.localCommandsDir = overrides.localCommandsDir ?? '.opencode/commands';
  }

  scaffoldSkill(dirPath: string, rawName: string): string {
    const name = assertSafeName(rawName);
    const skillDir = resolveWithin(dirPath, name);
    if (!skillDir) throw new Error('Invalid destination path');
    if (fs.existsSync(skillDir)) throw new Error(`A skill named "${name}" already exists`);
    const filePath = path.join(skillDir, 'SKILL.md');
    fs.mkdirSync(skillDir, { recursive: true });
    try {
      fs.writeFileSync(filePath, SKILL_TEMPLATE(name), 'utf-8');
    } catch (err) {
      if (fs.existsSync(skillDir)) fs.rmSync(skillDir, { recursive: true, force: true });
      throw err;
    }
    return filePath;
  }

  scaffoldCommand(dirPath: string, rawName: string): string {
    const name = assertSafeName(rawName);
    const filePath = resolveWithin(dirPath, `${name}.md`);
    if (!filePath) throw new Error('Invalid destination path');
    if (fs.existsSync(filePath)) throw new Error(`A command named "${name}" already exists`);
    fs.writeFileSync(filePath, COMMAND_TEMPLATE, 'utf-8');
    return filePath;
  }

  async createSkill(workspaceRoot?: string): Promise<void> {
    const destination = await this.pickDestination(workspaceRoot);
    const name = await this.pickName('Skill name');
    const dir =
      destination === 'global'
        ? this.globalSkillsDir
        : path.join(workspaceRoot!, this.localSkillsDir);
    this.scaffoldSkill(dir, name);
  }

  async createCommand(workspaceRoot?: string): Promise<void> {
    const destination = await this.pickDestination(workspaceRoot);
    const name = await this.pickName('Command name');
    const dir =
      destination === 'global'
        ? this.globalCommandsDir
        : path.join(workspaceRoot!, this.localCommandsDir);
    this.scaffoldCommand(dir, name);
  }

  private async pickDestination(workspaceRoot?: string): Promise<'global' | 'local'> {
    const hasWorkspace = Boolean(workspaceRoot);
    const items: vscode.QuickPickItem[] = [
      { label: 'Global', detail: '~/.config/opencode' },
      {
        label: 'Local',
        detail: hasWorkspace ? 'Current workspace .opencode' : 'Requires an open workspace folder',
        description: hasWorkspace ? undefined : '(unavailable)',
      },
    ];
    const pick = await vscode.window.showQuickPick(items, {
      placeHolder: 'Where should this be created?',
    });
    if (!pick) throw new Error('Creation cancelled');
    if (pick.label === 'Local' && !hasWorkspace) {
      throw new Error('Local creation requires an open workspace folder');
    }
    return pick.label === 'Global' ? 'global' : 'local';
  }

  private async pickName(prompt: string): Promise<string> {
    const name = await vscode.window.showInputBox({
      prompt,
      validateInput: (value) => {
        try {
          assertSafeName(value);
          return undefined;
        } catch (err) {
          return err instanceof Error ? err.message : 'Invalid name';
        }
      },
    });
    if (name === undefined) throw new Error('Creation cancelled');
    return name;
  }
}
