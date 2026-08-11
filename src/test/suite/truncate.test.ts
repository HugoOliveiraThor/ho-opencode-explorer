import * as assert from 'assert';
import { truncateEnd, truncateMiddle } from '../../util/truncate';

suite('truncate', () => {
  test('truncateEnd keeps short input as-is', () => {
    assert.strictEqual(truncateEnd('abc', 5), 'abc');
  });

  test('truncateEnd truncates and appends ellipsis', () => {
    const out = truncateEnd('abcdefghij', 6);
    assert.strictEqual(out, 'abcde…');
    assert.strictEqual(out.length, 6);
  });

  test('truncateMiddle keeps short input as-is', () => {
    assert.strictEqual(truncateMiddle('/a/b/c', 20), '/a/b/c');
  });

  test('truncateMiddle keeps head and tail around ellipsis', () => {
    const input = '/Users/hugo/.config/opencode/skills/api-design/SKILL.md';
    const out = truncateMiddle(input, 40);
    assert.strictEqual(out.length, 40);
    assert.ok(out.startsWith('/Users/hugo/.c'));
    assert.ok(out.endsWith('/SKILL.md'));
    assert.ok(out.includes('…'));
  });
});
