import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { extractFrontmatter, extractBody } from '../scanner/frontmatter.js';

export interface SkillChanges {
  name: string;
  description: string;
  enabled: boolean;
}

export class SkillEditor {
  editSkill(filePath: string, changes: SkillChanges): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const frontmatter = extractFrontmatter(content);
    const body = frontmatter ? extractBody(content) : content;

    let merged: Record<string, unknown>;
    if (frontmatter) {
      const parsed = YAML.parse(frontmatter) as Record<string, unknown>;
      merged = { ...parsed, ...changes };
    } else {
      merged = { ...changes };
    }

    const serialized = YAML.stringify(merged).trimEnd();
    const newContent = `---\n${serialized}\n---` + (body ? `\n\n${body}` : '') + '\n';
    this.writeAtomic(filePath, newContent);
  }

  private writeAtomic(filePath: string, content: string): void {
    const dir = path.dirname(filePath);
    const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
    fs.writeFileSync(tmpPath, content, 'utf-8');
    fs.renameSync(tmpPath, filePath);
  }
}
