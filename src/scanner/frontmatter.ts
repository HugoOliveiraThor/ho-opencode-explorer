export function extractFrontmatter(content: string): string | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1]! : null;
}

export function extractBody(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1]!.trim() : '';
}
