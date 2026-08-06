import * as fs from 'fs';
import * as path from 'path';

interface ContentMoverRoots {
  globalSkillsDir: string;
  localSkillsDir: string;
  globalCommandsDir: string;
  localCommandsDir: string;
}

export class ContentMover {
  private readonly globalSkillsDir: string;
  private readonly localSkillsDir: string;
  private readonly globalCommandsDir: string;
  private readonly localCommandsDir: string;

  constructor(overrides: Partial<ContentMoverRoots> = {}) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    this.globalSkillsDir =
      overrides.globalSkillsDir ?? path.join(home, '.config', 'opencode', 'skills');
    this.localSkillsDir = overrides.localSkillsDir ?? '.opencode/skills';
    this.globalCommandsDir =
      overrides.globalCommandsDir ?? path.join(home, '.config', 'opencode', 'commands');
    this.localCommandsDir = overrides.localCommandsDir ?? '.opencode/commands';
  }

  moveSkill(filePath: string, source: 'global' | 'local', workspaceRoot?: string): string {
    const dirName = path.basename(path.dirname(filePath));
    const target = this.targetDir(source, workspaceRoot, 'skills');
    const targetPath = path.join(target, dirName);
    if (fs.existsSync(targetPath)) {
      throw new Error(`A skill named "${dirName}" already exists at the destination`);
    }
    this.move(filePath, targetPath);
    return targetPath;
  }

  moveCommand(filePath: string, source: 'global' | 'local', workspaceRoot?: string): string {
    const fileName = path.basename(filePath);
    const target = this.targetDir(source, workspaceRoot, 'commands');
    const targetPath = path.join(target, fileName);
    if (fs.existsSync(targetPath)) {
      throw new Error(`A command named "${fileName}" already exists at the destination`);
    }
    this.move(filePath, targetPath);
    return targetPath;
  }

  private targetDir(
    source: 'global' | 'local',
    workspaceRoot: string | undefined,
    kind: 'skills' | 'commands',
  ): string {
    if (source === 'global') {
      if (!workspaceRoot) throw new Error('Local operations require an open workspace folder');
      const rel = kind === 'skills' ? this.localSkillsDir : this.localCommandsDir;
      return path.join(workspaceRoot, rel);
    }
    return kind === 'skills' ? this.globalSkillsDir : this.globalCommandsDir;
  }

  private move(from: string, to: string): void {
    try {
      fs.renameSync(from, to);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'EXDEV') {
        fs.cpSync(from, to, { recursive: true });
        fs.rmSync(from, { recursive: true, force: true });
      } else {
        throw err;
      }
    }
  }
}
