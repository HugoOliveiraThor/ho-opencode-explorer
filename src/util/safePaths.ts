import * as path from 'path';

export function toKebabCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function assertSafeName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error('Name cannot be empty');
  if (trimmed === '.' || trimmed === '..') throw new Error('Invalid name');
  if (/[/\\]/.test(trimmed)) throw new Error('Name cannot contain path separators');
  for (const ch of trimmed) {
    if (ch.charCodeAt(0) < 32) throw new Error('Name contains control characters');
  }
  const kebab = toKebabCase(trimmed);
  if (kebab.length === 0) throw new Error('Name must contain at least one letter or digit');
  return kebab;
}

export function resolveWithin(base: string, relative: string): string | null {
  const resolvedBase = path.resolve(base);
  const resolved = path.resolve(resolvedBase, relative);
  if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + path.sep)) {
    return null;
  }
  return resolved;
}
