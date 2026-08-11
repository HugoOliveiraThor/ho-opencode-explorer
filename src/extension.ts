import * as vscode from 'vscode';
import { SkillsScanner } from './scanner/SkillsScanner';
import { CommandsScanner } from './scanner/CommandsScanner';
import { AgentsScanner } from './scanner/AgentsScanner';
import { McpScanner } from './scanner/McpScanner';
import { PromptsScanner } from './scanner/PromptsScanner';
import { createExplorerView, type ExplorerView } from './tree/sections';
import type { ContentNode } from './tree/content';
import { DetailPanel } from './panel/DetailPanel';
import { SkillToggleManager } from './toggle/SkillToggleManager';
import { UpdateService } from './update/UpdateService';
import { ContentCreator } from './create/ContentCreator';
import { ContentMover } from './move/ContentMover';
import { HiddenSkillsManager, type HiddenSkillsStore } from './hidden/HiddenSkillsManager';
import type { DetailItem, Skill } from './types';

let scanner: SkillsScanner;
let commandsScanner: CommandsScanner;
let agentsScanner: AgentsScanner;
let mcpScanner: McpScanner;
let promptsScanner: PromptsScanner;
let explorerView: ExplorerView;
let detailPanel: DetailPanel;
let toggleManager: SkillToggleManager;
let updateService: UpdateService;
let contentCreator: ContentCreator;
let contentMover: ContentMover;
let hiddenSkillsManager: HiddenSkillsManager;
let skillsDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let commandsDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let agentsDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let mcpDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let promptsDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let extensionVersion = '0.0.0';

class MementoHiddenSkillsStore implements HiddenSkillsStore {
  constructor(private readonly memento: vscode.Memento) {}

  get(): string[] {
    return this.memento.get<string[]>('hiddenSkills', []);
  }

  set(paths: string[]): void {
    void this.memento.update('hiddenSkills', paths);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  scanner = new SkillsScanner();
  commandsScanner = new CommandsScanner();
  agentsScanner = new AgentsScanner();
  mcpScanner = new McpScanner();
  promptsScanner = new PromptsScanner();
  hiddenSkillsManager = new HiddenSkillsManager(new MementoHiddenSkillsStore(context.globalState));
  explorerView = createExplorerView(() => hiddenSkillsManager.list());
  toggleManager = new SkillToggleManager();
  updateService = new UpdateService();
  detailPanel = new DetailPanel({ onSkillEdited });
  contentCreator = new ContentCreator();
  contentMover = new ContentMover();

  // Single consolidated TreeView
  const explorerTreeView = vscode.window.createTreeView('ho-opencode-explorer-main', {
    treeDataProvider: explorerView.provider,
    canSelectMany: false,
  });
  context.subscriptions.push(explorerTreeView);

  // Shared Detail Panel
  const panelRegistration = vscode.window.registerWebviewViewProvider(
    'ho-opencode-detail',
    detailPanel,
    { webviewOptions: { retainContextWhenHidden: false } },
  );
  context.subscriptions.push(panelRegistration);

  // Selection → detail panel
  context.subscriptions.push(onSelection(explorerTreeView));

  // Skill checkbox toggle (only skill items carry a checkbox)
  context.subscriptions.push(
    explorerTreeView.onDidChangeCheckboxState(async (event) => {
      for (const [node, state] of event.items) {
        if (node.type !== 'item' || node.item.itemType !== 'skill') continue;
        try {
          const newEnabled = state === vscode.TreeItemCheckboxState.Checked;
          if (newEnabled !== node.item.enabled) {
            toggleManager.toggle(node.item.path);
          }
        } catch (err) {
          vscode.window.showErrorMessage(
            `Failed to toggle skill: ${err instanceof Error ? err.message : 'Unknown error'}`,
          );
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

  // Refresh commands
  const refreshSkillsCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.refreshSkills#sideBar',
    refreshSkills,
  );
  context.subscriptions.push(refreshSkillsCommand);
  const refreshCommandsCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.refreshCommands#sideBar',
    refreshCommands,
  );
  context.subscriptions.push(refreshCommandsCommand);

  // Hide Skill command
  const hideSkillCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.hideSkill#sideBar',
    (node: ContentNode<DetailItem>) => {
      if (node.type !== 'item' || node.item.itemType !== 'skill') return;
      hiddenSkillsManager.hide(node.item.path);
      refreshSkills();
    },
  );
  context.subscriptions.push(hideSkillCommand);

  // Show Hidden Skills command
  const showHiddenSkillsCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.showHiddenSkills#sideBar',
    async () => {
      const hidden = hiddenSkillsManager.list();
      if (hidden.length === 0) {
        vscode.window.showInformationMessage('No hidden skills.');
        return;
      }
      const selected = await vscode.window.showQuickPick(hidden, {
        canPickMany: true,
        placeHolder: 'Select skills to show again',
      });
      if (!selected || selected.length === 0) return;
      hiddenSkillsManager.unhide(selected);
      refreshSkills();
    },
  );
  context.subscriptions.push(showHiddenSkillsCommand);

  // Open commands (each only handles its own item type)
  const openSkillCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.openSkill#sideBar',
    (node: ContentNode<DetailItem>) => {
      if (node.type !== 'item' || node.item.itemType !== 'skill') return;
      vscode.commands.executeCommand('vscode.open', vscode.Uri.file(node.item.path));
    },
  );
  context.subscriptions.push(openSkillCommand);

  const openCommandCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.openCommand#sideBar',
    (node: ContentNode<DetailItem>) => {
      if (node.type !== 'item' || node.item.itemType !== 'command') return;
      if (!node.item.path) return;
      vscode.commands.executeCommand('vscode.open', vscode.Uri.file(node.item.path));
    },
  );
  context.subscriptions.push(openCommandCommand);

  const openAgentCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.openAgent#sideBar',
    (node: ContentNode<DetailItem>) => {
      if (node.type !== 'item' || node.item.itemType !== 'agent') return;
      vscode.commands.executeCommand('vscode.open', vscode.Uri.file(node.item.path));
    },
  );
  context.subscriptions.push(openAgentCommand);

  const openMcpCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.openMcp#sideBar',
    (node: ContentNode<DetailItem>) => {
      if (node.type !== 'item' || node.item.itemType !== 'mcp') return;
      vscode.commands.executeCommand('vscode.open', vscode.Uri.file(node.item.path));
    },
  );
  context.subscriptions.push(openMcpCommand);

  const openPromptCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.openPrompt#sideBar',
    (node: ContentNode<DetailItem>) => {
      if (node.type !== 'item' || node.item.itemType !== 'prompt') return;
      vscode.commands.executeCommand('vscode.open', vscode.Uri.file(node.item.path));
    },
  );
  context.subscriptions.push(openPromptCommand);

  // New commands
  const newSkillCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.newSkill#sideBar',
    async () => {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      try {
        await contentCreator.createSkill(workspaceRoot);
        await refreshSkills();
      } catch (err) {
        if (err instanceof Error && err.message.includes('cancelled')) return;
        vscode.window.showErrorMessage(
          err instanceof Error ? err.message : 'Failed to create skill',
        );
      }
    },
  );
  context.subscriptions.push(newSkillCommand);

  const newCommandCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.newCommand#sideBar',
    async () => {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      try {
        await contentCreator.createCommand(workspaceRoot);
        await refreshCommands();
      } catch (err) {
        if (err instanceof Error && err.message.includes('cancelled')) return;
        vscode.window.showErrorMessage(
          err instanceof Error ? err.message : 'Failed to create command',
        );
      }
    },
  );
  context.subscriptions.push(newCommandCommand);

  // Move commands
  const moveSkillCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.moveSkill#sideBar',
    async (node: ContentNode<DetailItem>) => {
      if (node.type !== 'item' || node.item.itemType !== 'skill') return;
      const item = node.item;
      const dest = item.source === 'global' ? 'Local' : 'Global';
      const action = await vscode.window.showWarningMessage(
        `Move skill "${item.name}" to ${dest}? The original will be removed.`,
        { modal: true },
        'Move',
        'Cancel',
      );
      if (action !== 'Move') return;
      try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        contentMover.moveSkill(item.path, item.source, workspaceRoot);
        await refreshSkills();
      } catch (err) {
        vscode.window.showErrorMessage(
          err instanceof Error ? err.message : 'Failed to move skill',
        );
      }
    },
  );
  context.subscriptions.push(moveSkillCommand);

  const moveCommandCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.moveCommand#sideBar',
    async (node: ContentNode<DetailItem>) => {
      if (node.type !== 'item' || node.item.itemType !== 'command') return;
      const item = node.item;
      const scope = item.scope;
      const pathValue = item.path;
      if (!scope || !pathValue) return;
      const dest = scope === 'global' ? 'Local' : 'Global';
      const action = await vscode.window.showWarningMessage(
        `Move command "${item.name}" to ${dest}? The original will be removed.`,
        { modal: true },
        'Move',
        'Cancel',
      );
      if (action !== 'Move') return;
      try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        contentMover.moveCommand(pathValue, scope, workspaceRoot);
        await refreshCommands();
      } catch (err) {
        vscode.window.showErrorMessage(
          err instanceof Error ? err.message : 'Failed to move command',
        );
      }
    },
  );
  context.subscriptions.push(moveCommandCommand);

  setupFileWatchers(context);

  const pkgJson = context.extension.packageJSON as { version: string };
  extensionVersion = pkgJson.version;
  updateViewTitle();

  refreshSkills();
  refreshCommands();
  refreshAgents();
  refreshMcp();
  refreshPrompts();
}

function onSkillEdited(updated: Skill): void {
  refreshSkills();
  detailPanel.show(updated);
}

function onSelection(
  treeView: vscode.TreeView<ContentNode<DetailItem>>,
): vscode.Disposable {
  return treeView.onDidChangeSelection((event) => {
    const node = event.selection[0];
    if (node && node.type === 'item') {
      detailPanel.show(node.item);
    } else {
      detailPanel.clear();
    }
  });
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

  const commandsFilePattern = new vscode.RelativePattern(
    vscode.Uri.file(home),
    '.config/opencode/commands/**/*.md',
  );
  const commandsFileWatcher = vscode.workspace.createFileSystemWatcher(commandsFilePattern);
  commandsFileWatcher.onDidChange(debouncedRefreshCommands);
  commandsFileWatcher.onDidCreate(debouncedRefreshCommands);
  commandsFileWatcher.onDidDelete(debouncedRefreshCommands);
  context.subscriptions.push(commandsFileWatcher);

  const configPattern = new vscode.RelativePattern(
    vscode.Uri.file(home),
    '.config/opencode/opencode.json',
  );
  const configWatcher = vscode.workspace.createFileSystemWatcher(configPattern);
  configWatcher.onDidChange(() => {
    debouncedRefreshSkills();
    debouncedRefreshCommands();
    debouncedRefreshAgents();
    debouncedRefreshMcp();
    debouncedRefreshPrompts();
  });
  configWatcher.onDidCreate(() => {
    debouncedRefreshSkills();
    debouncedRefreshCommands();
    debouncedRefreshAgents();
    debouncedRefreshMcp();
    debouncedRefreshPrompts();
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

  const agentsGlobalPattern = new vscode.RelativePattern(
    vscode.Uri.file(home),
    '.config/opencode/agent/**/*.md',
  );
  const agentsGlobalWatcher = vscode.workspace.createFileSystemWatcher(agentsGlobalPattern);
  agentsGlobalWatcher.onDidChange(debouncedRefreshAgents);
  agentsGlobalWatcher.onDidCreate(debouncedRefreshAgents);
  agentsGlobalWatcher.onDidDelete(debouncedRefreshAgents);
  context.subscriptions.push(agentsGlobalWatcher);

  if (workspaceFolders && workspaceFolders.length > 0) {
    const agentsLocalPattern = new vscode.RelativePattern(
      workspaceFolders[0]!,
      '.opencode/agent/**/*.md',
    );
    const agentsLocalWatcher = vscode.workspace.createFileSystemWatcher(agentsLocalPattern);
    agentsLocalWatcher.onDidChange(debouncedRefreshAgents);
    agentsLocalWatcher.onDidCreate(debouncedRefreshAgents);
    agentsLocalWatcher.onDidDelete(debouncedRefreshAgents);
    context.subscriptions.push(agentsLocalWatcher);
  }

  if (workspaceFolders && workspaceFolders.length > 0) {
    const mcpPattern = new vscode.RelativePattern(workspaceFolders[0]!, '.mcp.json');
    const mcpWatcher = vscode.workspace.createFileSystemWatcher(mcpPattern);
    mcpWatcher.onDidChange(debouncedRefreshMcp);
    mcpWatcher.onDidCreate(debouncedRefreshMcp);
    mcpWatcher.onDidDelete(debouncedRefreshMcp);
    context.subscriptions.push(mcpWatcher);
  }

  const promptsGlobalPattern = new vscode.RelativePattern(
    vscode.Uri.file(home),
    '.config/opencode/prompts/**/*.{txt,md}',
  );
  const promptsGlobalWatcher = vscode.workspace.createFileSystemWatcher(promptsGlobalPattern);
  promptsGlobalWatcher.onDidChange(debouncedRefreshPrompts);
  promptsGlobalWatcher.onDidCreate(debouncedRefreshPrompts);
  promptsGlobalWatcher.onDidDelete(debouncedRefreshPrompts);
  context.subscriptions.push(promptsGlobalWatcher);

  if (workspaceFolders && workspaceFolders.length > 0) {
    const promptsLocalPattern = new vscode.RelativePattern(
      workspaceFolders[0]!,
      '.opencode/prompt/**/*.{txt,md}',
    );
    const promptsLocalWatcher = vscode.workspace.createFileSystemWatcher(promptsLocalPattern);
    promptsLocalWatcher.onDidChange(debouncedRefreshPrompts);
    promptsLocalWatcher.onDidCreate(debouncedRefreshPrompts);
    promptsLocalWatcher.onDidDelete(debouncedRefreshPrompts);
    context.subscriptions.push(promptsLocalWatcher);

    const instructionsPattern = new vscode.RelativePattern(
      workspaceFolders[0]!,
      '{AGENTS.md,CLAUDE.md}',
    );
    const instructionsWatcher = vscode.workspace.createFileSystemWatcher(instructionsPattern);
    instructionsWatcher.onDidChange(debouncedRefreshPrompts);
    instructionsWatcher.onDidCreate(debouncedRefreshPrompts);
    instructionsWatcher.onDidDelete(debouncedRefreshPrompts);
    context.subscriptions.push(instructionsWatcher);
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

function debouncedRefreshAgents(): void {
  if (agentsDebounceTimer) clearTimeout(agentsDebounceTimer);
  agentsDebounceTimer = setTimeout(() => refreshAgents(), 500);
}

function debouncedRefreshMcp(): void {
  if (mcpDebounceTimer) clearTimeout(mcpDebounceTimer);
  mcpDebounceTimer = setTimeout(() => refreshMcp(), 500);
}

function debouncedRefreshPrompts(): void {
  if (promptsDebounceTimer) clearTimeout(promptsDebounceTimer);
  promptsDebounceTimer = setTimeout(() => refreshPrompts(), 500);
}

async function refreshSkills(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

  const { global, local } = await scanner.scanAll(workspaceRoot);
  explorerView.setSkills(global, local);
  updateViewTitle();
}

async function refreshCommands(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

  const groups = await commandsScanner.scanAll(workspaceRoot);
  explorerView.setCommands(groups);
}

async function refreshAgents(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

  const result = await agentsScanner.scanAll(workspaceRoot);
  explorerView.setAgents(result.config, result.global, result.local);
}

async function refreshMcp(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

  const result = await mcpScanner.scanAll(workspaceRoot);
  explorerView.setMcp(result.global, result.project);
}

async function refreshPrompts(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

  const result = await promptsScanner.scanAll(workspaceRoot);
  explorerView.setPrompts(result.global, result.local);
}

function updateViewTitle(): void {
  vscode.commands.executeCommand(
    'setContext',
    'ho-opencode-explorer.version',
    `v${extensionVersion}`,
  );
}

export function deactivate(): void {
  for (const timer of [
    skillsDebounceTimer,
    commandsDebounceTimer,
    agentsDebounceTimer,
    mcpDebounceTimer,
    promptsDebounceTimer,
  ]) {
    if (timer) clearTimeout(timer);
  }
  skillsDebounceTimer = undefined;
  commandsDebounceTimer = undefined;
  agentsDebounceTimer = undefined;
  mcpDebounceTimer = undefined;
  promptsDebounceTimer = undefined;
}
