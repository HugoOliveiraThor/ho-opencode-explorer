import * as vscode from 'vscode';
import { SkillsScanner } from './scanner/SkillsScanner';
import { SkillTreeDataProvider } from './tree/SkillTreeDataProvider';
import { SkillDetailPanel } from './panel/SkillDetailPanel';
import { SkillToggleManager } from './toggle/SkillToggleManager';
import { UpdateService } from './update/UpdateService';

let scanner: SkillsScanner;
let treeProvider: SkillTreeDataProvider;
let detailPanel: SkillDetailPanel;
let toggleManager: SkillToggleManager;
let updateService: UpdateService;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

export function activate(context: vscode.ExtensionContext): void {
  scanner = new SkillsScanner();
  treeProvider = new SkillTreeDataProvider();
  toggleManager = new SkillToggleManager();
  updateService = new UpdateService();
  detailPanel = new SkillDetailPanel();

  const treeView = vscode.window.createTreeView('ho-opencode-skills', {
    treeDataProvider: treeProvider,
    canSelectMany: false,
  });
  context.subscriptions.push(treeView);

  const panelRegistration = vscode.window.registerWebviewViewProvider(
    'ho-opencode-skill-detail',
    detailPanel,
    { webviewOptions: { retainContextWhenHidden: false } },
  );
  context.subscriptions.push(panelRegistration);

  treeView.onDidChangeSelection((event) => {
    const node = event.selection[0];
    if (node && node.type === 'skill') {
      detailPanel.showSkill(node.skill);
    } else {
      detailPanel.clear();
    }
  });

  treeView.onDidChangeCheckboxState(async (event) => {
    for (const [node, state] of event.items) {
      if (node.type === 'skill') {
        try {
          const newEnabled = state === vscode.TreeItemCheckboxState.Checked;
          if (newEnabled !== node.skill.enabled) {
            toggleManager.toggle(node.skill.path);
          }
        } catch (err) {
          vscode.window.showErrorMessage(
            `Failed to toggle skill: ${err instanceof Error ? err.message : 'Unknown error'}`,
          );
        }
      }
    }
    await refreshSkills();
  });

  const updateCommand = vscode.commands.registerCommand(
    'ho-opencode-explorer.checkForUpdates',
    async () => {
      const packageJson = context.extension.packageJSON as { version: string };
      await updateService.checkForUpdates(packageJson.version);
    },
  );
  context.subscriptions.push(updateCommand);

  const refreshCommand = vscode.commands.registerCommand(
    'ho-opencode-explorer.refreshSkills',
    refreshSkills,
  );
  context.subscriptions.push(refreshCommand);

  const openSkillCommand = vscode.commands.registerCommand(
    'ho-opencode-explorer.openSkill',
    (skillPath: string) => {
      const uri = vscode.Uri.file(skillPath);
      vscode.commands.executeCommand('vscode.open', uri);
    },
  );
  context.subscriptions.push(openSkillCommand);

  setupFileWatchers(context);

  refreshSkills();
}

function setupFileWatchers(context: vscode.ExtensionContext): void {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const patterns = [
    new vscode.RelativePattern(vscode.Uri.file(home), '.config/opencode/skills/**/SKILL.md'),
    new vscode.RelativePattern(vscode.Uri.file(home), '.opencode/skills/**/SKILL.md'),
    new vscode.RelativePattern(vscode.Uri.file(home), '.cache/opencode/packages/**/SKILL.md'),
  ];

  for (const pattern of patterns) {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidChange(debouncedRefresh);
    watcher.onDidCreate(debouncedRefresh);
    watcher.onDidDelete(debouncedRefresh);
    context.subscriptions.push(watcher);
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    const localPattern = new vscode.RelativePattern(
      workspaceFolders[0]!,
      '.opencode/skills/**/SKILL.md',
    );
    const localWatcher = vscode.workspace.createFileSystemWatcher(localPattern);
    localWatcher.onDidChange(debouncedRefresh);
    localWatcher.onDidCreate(debouncedRefresh);
    localWatcher.onDidDelete(debouncedRefresh);
    context.subscriptions.push(localWatcher);
  }
}

function debouncedRefresh(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => refreshSkills(), 500);
}

async function refreshSkills(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

  const { global, local } = await scanner.scanAll(workspaceRoot);
  treeProvider.setSkills(global, local);
}

export function deactivate(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }

  (treeProvider as unknown) = undefined;
  (scanner as unknown) = undefined;
  (detailPanel as unknown) = undefined;
  (toggleManager as unknown) = undefined;
  (updateService as unknown) = undefined;
}
