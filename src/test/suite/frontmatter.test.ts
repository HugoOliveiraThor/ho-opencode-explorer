import * as assert from 'assert';
import { extractFrontmatter, extractBody } from '../../scanner/frontmatter.js';

suite('frontmatter helper', () => {
  test('extracts YAML frontmatter', () => {
    const fm = extractFrontmatter('---\nname: foo\n---\nbody text');
    assert.strictEqual(fm, 'name: foo');
  });

  test('returns null when no frontmatter', () => {
    assert.strictEqual(extractFrontmatter('no frontmatter'), null);
  });

  test('extracts body after frontmatter', () => {
    const body = extractBody('---\nname: foo\n---\n\nbody line');
    assert.strictEqual(body, 'body line');
  });

  test('returns empty string when body empty', () => {
    assert.strictEqual(extractBody('---\nname: foo\n---'), '');
  });
});
