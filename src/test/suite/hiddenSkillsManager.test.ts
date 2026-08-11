import * as assert from 'assert';
import { HiddenSkillsManager, type HiddenSkillsStore } from '../../hidden/HiddenSkillsManager';

class FakeStore implements HiddenSkillsStore {
  data: string[] = [];
  get(): string[] {
    return [...this.data];
  }
  set(paths: string[]): void {
    this.data = [...paths];
  }
}

suite('HiddenSkillsManager', () => {
  test('hide adds a path once', () => {
    const store = new FakeStore();
    const manager = new HiddenSkillsManager(store);
    manager.hide('/a/SKILL.md');
    manager.hide('/a/SKILL.md');
    assert.deepStrictEqual(manager.list(), ['/a/SKILL.md']);
  });

  test('isHidden reflects hidden state', () => {
    const store = new FakeStore();
    const manager = new HiddenSkillsManager(store);
    manager.hide('/a/SKILL.md');
    assert.strictEqual(manager.isHidden('/a/SKILL.md'), true);
    assert.strictEqual(manager.isHidden('/b/SKILL.md'), false);
  });

  test('unhide removes selected paths only', () => {
    const store = new FakeStore();
    const manager = new HiddenSkillsManager(store);
    manager.hide('/a/SKILL.md');
    manager.hide('/b/SKILL.md');
    manager.unhide(['/a/SKILL.md']);
    assert.deepStrictEqual(manager.list(), ['/b/SKILL.md']);
  });

  test('list returns copy of stored paths', () => {
    const store = new FakeStore();
    store.set(['/a']);
    const manager = new HiddenSkillsManager(store);
    manager.list().push('/mutated');
    assert.deepStrictEqual(store.get(), ['/a']);
  });
});
