import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { extractFrontmatter } from './frontmatter.js';
import type { Skill, SkillSource } from '../types.js';

interface SkillFrontmatter {
  name?: string;
  description?: string;
  enabled?: boolean;
}

export class SkillsScanner {
  private readonly globalPaths: string[] = [];
  private readonly localPath: string = '.opencode/skills';

  constructor() {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    this.globalPaths = [
      path.join(home, '.config', 'opencode', 'skills'),
      path.join(home, '.opencode', 'skills'),
      path.join(home, '.cache', 'opencode', 'packages'),
    ];
  }

  async scanAll(workspaceRoot?: string): Promise<{ global: Skill[]; local: Skill[] }> {
    const globalSkills = await this.scanGlobalPaths();
    const localSkills = workspaceRoot
      ? await this.scanDirectory(path.join(workspaceRoot, this.localPath), 'local')
      : [];
    return { global: globalSkills, local: localSkills };
  }

  private async scanGlobalPaths(): Promise<Skill[]> {
    const results: Skill[] = [];
    for (const dir of this.globalPaths) {
      const skills = await this.scanDirectory(dir, 'global');
      results.push(...skills);
    }
    return results;
  }

  async scanDirectory(dirPath: string, source: SkillSource): Promise<Skill[]> {
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    const skills: Skill[] = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const fullPath = path.join(dirPath, entry.name);

      if (this.isPackageDir(dirPath)) {
        const nested = await this.scanPackageDir(fullPath, source);
        skills.push(...nested);
      } else if (this.hasSkillFile(fullPath)) {
        const skill = this.parseSkillFile(path.join(fullPath, 'SKILL.md'), source);
        skills.push(skill);
      }
    }

    return skills;
  }

  private isPackageDir(dirPath: string): boolean {
    return dirPath.includes('opencode/packages');
  }

  private async scanPackageDir(pkgPath: string, source: SkillSource): Promise<Skill[]> {
    const skills: Skill[] = [];
    const nodeModules = path.join(pkgPath, 'node_modules');
    if (!fs.existsSync(nodeModules)) return skills;

    const packages = fs.readdirSync(nodeModules, { withFileTypes: true });
    for (const pkg of packages) {
      if (!pkg.isDirectory()) continue;
      const skillsDir = path.join(nodeModules, pkg.name, 'skills');
      if (fs.existsSync(skillsDir)) {
        const nested = await this.scanDirectory(skillsDir, source);
        skills.push(...nested);
      }
    }
    return skills;
  }

  private hasSkillFile(dirPath: string): boolean {
    return fs.existsSync(path.join(dirPath, 'SKILL.md'));
  }

  private parseSkillFile(filePath: string, source: SkillSource): Skill {
    const dirName = path.basename(path.dirname(filePath));
    const content = fs.readFileSync(filePath, 'utf-8');

    try {
      const frontmatter = extractFrontmatter(content);
      if (frontmatter) {
        const parsed = YAML.parse(frontmatter) as SkillFrontmatter;
        return {
          itemType: 'skill',
          name: parsed.name || dirName,
          description: parsed.description || '',
          path: filePath,
          enabled: parsed.enabled !== false,
          source,
        };
      }
    } catch (err) {
      return {
        itemType: 'skill',
        name: dirName,
        description: '',
        path: filePath,
        enabled: false,
        source,
        yamlError: err instanceof Error ? err.message : 'Unknown YAML error',
      };
    }

    return {
      itemType: 'skill',
      name: dirName,
      description: '',
      path: filePath,
      enabled: true,
      source,
    };
  }
}
