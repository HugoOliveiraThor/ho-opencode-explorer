import * as fs from 'fs';
import * as YAML from 'yaml';

export class SkillToggleManager {
  toggle(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const newContent = this.toggleEnabledInContent(content);
    fs.writeFileSync(filePath, newContent);
  }

  isEnabled(filePath: string): boolean {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match || !match[1]) return true;
    try {
      const parsed = YAML.parse(match[1]) as { enabled?: boolean };
      return parsed.enabled !== false;
    } catch {
      return true;
    }
  }

  private toggleEnabledInContent(content: string): string {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) {
      return `---\nenabled: false\n---\n\n${content}`;
    }

    const frontmatter = frontmatterMatch[1]!;
    const rest = content.slice(frontmatterMatch[0].length);

    if (frontmatter.includes('enabled:')) {
      const toggled = frontmatter.replace(/^enabled:\s*(true|false)/m, (_match, val) =>
        val === 'true' ? 'enabled: false' : 'enabled: true',
      );
      return `---\n${toggled}\n---${rest}`;
    }

    return `---\n${frontmatter}\nenabled: false\n---${rest}`;
  }
}
