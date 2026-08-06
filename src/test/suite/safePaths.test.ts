import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import { assertSafeName, toKebabCase, resolveWithin } from '../../util/safePaths';

suite('safePaths', () => {
  test('assertSafeName kebab-cases a valid name', () => {
    assert.strictEqual(assertSafeName('My Skill'), 'my-skill');
  });

  test('assertSafeName rejects empty names', () => {
    assert.throws(() => assertSafeName('   '));
  });

  test('assertSafeName rejects dots', () => {
    assert.throws(() => assertSafeName('..'));
    assert.throws(() => assertSafeName('.'));
  });

  test('assertSafeName rejects path separators', () => {
    assert.throws(() => assertSafeName('a/b'));
    assert.throws(() => assertSafeName('a\\b'));
  });

  test('toKebabCase handles mixed input', () => {
    assert.strictEqual(toKebabCase('  Hello World!  '), 'hello-world');
  });

  test('resolveWithin resolves valid relative paths', () => {
    const base = os.tmpdir();
    const resolved = resolveWithin(base, 'sub/file');
    assert.ok(resolved);
    assert.strictEqual(resolved, path.resolve(base, 'sub/file'));
  });

  test('resolveWithin returns null on traversal', () => {
    const base = path.join(os.tmpdir(), 'safe-root');
    assert.strictEqual(resolveWithin(base, '../escape'), null);
    assert.strictEqual(resolveWithin(base, '/absolute'), null);
  });
});
