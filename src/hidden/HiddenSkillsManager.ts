export interface HiddenSkillsStore {
  get(): string[];
  set(paths: string[]): void;
}

export class HiddenSkillsManager {
  constructor(private readonly store: HiddenSkillsStore) {}

  isHidden(path: string): boolean {
    return this.store.get().includes(path);
  }

  hide(path: string): void {
    const current = this.store.get();
    if (!current.includes(path)) {
      this.store.set([...current, path]);
    }
  }

  unhide(paths: string[]): void {
    const toRemove = new Set(paths);
    this.store.set(this.store.get().filter((p) => !toRemove.has(p)));
  }

  list(): string[] {
    return this.store.get();
  }
}
