import * as vscode from 'vscode';
import { SkillsScanner } from './scanner/SkillsScanner';
import { CommandsScanner } from './scanner/CommandsScanner';
import { SkillTreeDataProvider } from './tree/SkillTreeDataProvider';
import { CommandsTreeDataProvider } from './tree/CommandsTreeDataProvider';
import { DetailPanel } from './panel/DetailPanel';
import { SkillToggleManager } from './toggle/SkillToggleManager';
import { UpdateService } from './update/UpdateService';

let scanner: SkillsScanner;
let commandsScanner: CommandsScanner;
let treeProvider: SkillTreeDataProvider;
let commandsTreeProvider: CommandsTreeDataProvider;
let detailPanel: DetailPanel;
let toggleManager: SkillToggleManager;
let updateService: UpdateService;
let skillsDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let commandsDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let extensionVersion = '0.0.0';

export function activate(context: vscode.ExtensionContext): void {
  scanner = new SkillsScanner();
  commandsScanner = new CommandsScanner();
  treeProvider = new SkillTreeDataProvider();
  commandsTreeProvider = new CommandsTreeDataProvider();
  toggleManager = new SkillToggleManager();
  updateService = new UpdateService();
  detailPanel = new DetailPanel();

  // Skills TreeView
  const skillsTreeView = vscode.window.createTreeView('ho-opencode-skills', {
    treeDataProvider: treeProvider,
    canSelectMany: false,
  });
  context.subscriptions.push(skillsTreeView);

  // Commands TreeView
  const commandsTreeView = vscode.window.createTreeView('ho-opencode-commands', {
    treeDataProvider: commandsTreeProvider,
    canSelectMany: false,
  });
  context.subscriptions.push(commandsTreeView);

  // Shared Detail Panel
  const panelRegistration = vscode.window.registerWebviewViewProvider(
    'ho-opencode-detail',
    detailPanel,
    { webviewOptions: { retainContextWhenHidden: false } },
  );
  context.subscriptions.push(panelRegistration);

  // Skills tree selection → detail panel
  context.subscriptions.push(
    skillsTreeView.onDidChangeSelection((event) => {
      const node = event.selection[0];
      if (node && node.type === 'skill') {
        detailPanel.showSkill(node.skill);
      } else {
        detailPanel.clear();
      }
    }),
  );

  // Commands tree selection → detail panel
  context.subscriptions.push(
    commandsTreeView.onDidChangeSelection((event) => {
      const node = event.selection[0];
      if (node && node.type === 'command') {
        detailPanel.showCommand(node.command);
      } else {
        detailPanel.clear();
      }
    }),
  );

  // Skills checkbox toggle
  context.subscriptions.push(
    skillsTreeView.onDidChangeCheckboxState(async (event) => {
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
    }),
  );

  // Check for updates command
  const updateCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.checkForUpdates#sideBar',
    async () => {
      const packageJson = context.extension.packageJSON as { version: string };
      await updateService.checkForUpdates(packageJson.version);
    },
  );
  context.subscriptions.push(updateCommand);

  // Refresh Skills command
  const refreshSkillsCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.refreshSkills#sideBar',
    refreshSkills,
  );
  context.subscriptions.push(refreshSkillsCommand);

  // Refresh Commands command
  const refreshCommandsCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.refreshCommands#sideBar',
    refreshCommands,
  );
  context.subscriptions.push(refreshCommandsCommand);

  // Open Skill command
  const openSkillCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.openSkill#sideBar',
    (skillPath: string) => {
      const uri = vscode.Uri.file(skillPath);
      vscode.commands.executeCommand('vscode.open', uri);
    },
  );
  context.subscriptions.push(openSkillCommand);

  // Open Command command
  const openCommandCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.openCommand#sideBar',
    (commandPath: string) => {
      const uri = vscode.Uri.file(commandPath);
      vscode.commands.executeCommand('vscode.open', uri);
    },
  );
  context.subscriptions.push(openCommandCommand);

  setupFileWatchers(context);

  const pkgJson = context.extension.packageJSON as { version: string };
  extensionVersion = pkgJson.version;
  updateViewTitle();

  refreshSkills();
  refreshCommands();
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
    watcher.onDidChange(debouncedRefreshSkills);
    watcher.onDidCreate(debouncedRefreshSkills);
    watcher.onDidDelete(debouncedRefreshSkills);
    context.subscriptions.push(watcher);
  }

  // Local skills watcher
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    const localPattern = new vscode.RelativePattern(
      workspaceFolders[0]!,
      '.opencode/skills/**/SKILL.md',
    );
    const localWatcher = vscode.workspace.createFileSystemWatcher(localPattern);
    localWatcher.onDidChange(debouncedRefreshSkills);
    localWatcher.onDidCreate(debouncedRefreshSkills);
    localWatcher.onDidDelete(debouncedRefreshSkills);
    context.subscriptions.push(localWatcher);
  }

  // Commands file watchers
  const commandsFilePattern = new vscode.RelativePattern(
    vscode.Uri.file(home),
    '.config/opencode/commands/**/*.md',
  );
  const commandsFileWatcher = vscode.workspace.createFileSystemWatcher(commandsFilePattern);
  commandsFileWatcher.onDidChange(debouncedRefreshCommands);
  commandsFileWatcher.onDidCreate(debouncedRefreshCommands);
  commandsFileWatcher.onDidDelete(debouncedRefreshCommands);
  context.subscriptions.push(commandsFileWatcher);

  // opencode.json watcher (affects both commands and skills)
  const configPattern = new vscode.RelativePattern(
    vscode.Uri.file(home),
    '.config/opencode/opencode.json',
  );
  const configWatcher = vscode.workspace.createFileSystemWatcher(configPattern);
  configWatcher.onDidChange(() => {
    debouncedRefreshSkills();
    debouncedRefreshCommands();
  });
  configWatcher.onDidCreate(() => {
    debouncedRefreshSkills();
    debouncedRefreshCommands();
  });
  context.subscriptions.push(configWatcher);

  if (workspaceFolders && workspaceFolders.length > 0) {
    const localCommandsPattern = new vscode.RelativePattern(
      workspaceFolders[0]!,
      '.opencode/commands/**/*.md',
    );
    const localCommandsWatcher = vscode.workspace.createFileSystemWatcher(localCommandsPattern);
    localCommandsWatcher.onDidChange(debouncedRefreshCommands);
    localCommandsWatcher.onDidCreate(debouncedRefreshCommands);
    localCommandsWatcher.onDidDelete(debouncedRefreshCommands);
    context.subscriptions.push(localCommandsWatcher);
  }
}

function debouncedRefreshSkills(): void {
  if (skillsDebounceTimer) clearTimeout(skillsDebounceTimer);
  skillsDebounceTimer = setTimeout(() => refreshSkills(), 500);
}

function debouncedRefreshCommands(): void {
  if (commandsDebounceTimer) clearTimeout(commandsDebounceTimer);
  commandsDebounceTimer = setTimeout(() => refreshCommands(), 500);
}

async function refreshSkills(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

  const { global, local } = await scanner.scanAll(workspaceRoot);
  treeProvider.setSkills(global, local);
  updateViewTitle();
}

async function refreshCommands(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

  const groups = await commandsScanner.scanAll(workspaceRoot);
  commandsTreeProvider.setGroups(groups);
}

function updateViewTitle(): void {
  vscode.commands.executeCommand(
    'setContext',
    'ho-opencode-explorer.version',
    `v${extensionVersion}`,
  );
}

export function deactivate(): void {
  if (skillsDebounceTimer) {
    clearTimeout(skillsDebounceTimer);
    skillsDebounceTimer = undefined;
  }
  if (commandsDebounceTimer) {
    clearTimeout(commandsDebounceTimer);
    commandsDebounceTimer = undefined;
  }
}
