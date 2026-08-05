import * as vscode from 'vscode';
import { SkillsScanner } from './scanner/SkillsScanner';
import { CommandsScanner } from './scanner/CommandsScanner';
import { AgentsScanner } from './scanner/AgentsScanner';
import { McpScanner } from './scanner/McpScanner';
import { PromptsScanner } from './scanner/PromptsScanner';
import { createSkillsView } from './tree/skills';
import { createCommandsView } from './tree/commands';
import { createAgentsView } from './tree/agents';
import { createMcpView } from './tree/mcp';
import { createPromptsView } from './tree/prompts';
import type { ContentNode } from './tree/content';
import { DetailPanel } from './panel/DetailPanel';
import { SkillToggleManager } from './toggle/SkillToggleManager';
import { UpdateService } from './update/UpdateService';
import type { DetailItem } from './types';

let scanner: SkillsScanner;
let commandsScanner: CommandsScanner;
let agentsScanner: AgentsScanner;
let mcpScanner: McpScanner;
let promptsScanner: PromptsScanner;
let skillsView: ReturnType<typeof createSkillsView>;
let commandsView: ReturnType<typeof createCommandsView>;
let agentsView: ReturnType<typeof createAgentsView>;
let mcpView: ReturnType<typeof createMcpView>;
let promptsView: ReturnType<typeof createPromptsView>;
let detailPanel: DetailPanel;
let toggleManager: SkillToggleManager;
let updateService: UpdateService;
let skillsDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let commandsDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let agentsDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let mcpDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let promptsDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let extensionVersion = '0.0.0';

export function activate(context: vscode.ExtensionContext): void {
  scanner = new SkillsScanner();
  commandsScanner = new CommandsScanner();
  agentsScanner = new AgentsScanner();
  mcpScanner = new McpScanner();
  promptsScanner = new PromptsScanner();
  skillsView = createSkillsView();
  commandsView = createCommandsView();
  agentsView = createAgentsView();
  mcpView = createMcpView();
  promptsView = createPromptsView();
  toggleManager = new SkillToggleManager();
  updateService = new UpdateService();
  detailPanel = new DetailPanel();

  // Skills TreeView
  const skillsTreeView = vscode.window.createTreeView('ho-opencode-skills', {
    treeDataProvider: skillsView.provider,
    canSelectMany: false,
  });
  context.subscriptions.push(skillsTreeView);

  // Commands TreeView
  const commandsTreeView = vscode.window.createTreeView('ho-opencode-commands', {
    treeDataProvider: commandsView.provider,
    canSelectMany: false,
  });
  context.subscriptions.push(commandsTreeView);

  // Agents TreeView
  const agentsTreeView = vscode.window.createTreeView('ho-opencode-agents', {
    treeDataProvider: agentsView.provider,
    canSelectMany: false,
  });
  context.subscriptions.push(agentsTreeView);

  // MCP TreeView
  const mcpTreeView = vscode.window.createTreeView('ho-opencode-mcp', {
    treeDataProvider: mcpView.provider,
    canSelectMany: false,
  });
  context.subscriptions.push(mcpTreeView);

  // Prompts TreeView
  const promptsTreeView = vscode.window.createTreeView('ho-opencode-prompts', {
    treeDataProvider: promptsView.provider,
    canSelectMany: false,
  });
  context.subscriptions.push(promptsTreeView);

  // Shared Detail Panel
  const panelRegistration = vscode.window.registerWebviewViewProvider(
    'ho-opencode-detail',
    detailPanel,
    { webviewOptions: { retainContextWhenHidden: false } },
  );
  context.subscriptions.push(panelRegistration);

  // Selection → detail panel (generic across all five views)
  context.subscriptions.push(
    onSelection(skillsTreeView),
    onSelection(commandsTreeView),
    onSelection(agentsTreeView),
    onSelection(mcpTreeView),
    onSelection(promptsTreeView),
  );

  // Skills checkbox toggle
  context.subscriptions.push(
    skillsTreeView.onDidChangeCheckboxState(async (event) => {
      for (const [node, state] of event.items) {
        if (node.type === 'item') {
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

  // Open Agent Source command
  const openAgentCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.openAgent#sideBar',
    (agentPath: string) => {
      const uri = vscode.Uri.file(agentPath);
      vscode.commands.executeCommand('vscode.open', uri);
    },
  );
  context.subscriptions.push(openAgentCommand);

  // Open MCP Config command
  const openMcpCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.openMcp#sideBar',
    (mcpPath: string) => {
      const uri = vscode.Uri.file(mcpPath);
      vscode.commands.executeCommand('vscode.open', uri);
    },
  );
  context.subscriptions.push(openMcpCommand);

  // Open Prompt command
  const openPromptCommand = vscode.commands.registerCommand(
    '_ho-opencode-explorer.openPrompt#sideBar',
    (promptPath: string) => {
      const uri = vscode.Uri.file(promptPath);
      vscode.commands.executeCommand('vscode.open', uri);
    },
  );
  context.subscriptions.push(openPromptCommand);

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

function onSelection<T extends DetailItem>(
  treeView: vscode.TreeView<ContentNode<T>>,
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

  // opencode.json watcher (affects all config-backed views)
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

  // Agents watchers
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

  // MCP project watcher
  if (workspaceFolders && workspaceFolders.length > 0) {
    const mcpPattern = new vscode.RelativePattern(workspaceFolders[0]!, '.mcp.json');
    const mcpWatcher = vscode.workspace.createFileSystemWatcher(mcpPattern);
    mcpWatcher.onDidChange(debouncedRefreshMcp);
    mcpWatcher.onDidCreate(debouncedRefreshMcp);
    mcpWatcher.onDidDelete(debouncedRefreshMcp);
    context.subscriptions.push(mcpWatcher);
  }

  // Prompts watchers
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
  skillsView.setData(global, local);
  updateViewTitle();
}

async function refreshCommands(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

  const groups = await commandsScanner.scanAll(workspaceRoot);
  commandsView.setData(groups);
}

async function refreshAgents(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

  const result = await agentsScanner.scanAll(workspaceRoot);
  agentsView.setData(result.config, result.global, result.local);
}

async function refreshMcp(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

  const result = await mcpScanner.scanAll(workspaceRoot);
  mcpView.setData(result.global, result.project);
}

async function refreshPrompts(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

  const result = await promptsScanner.scanAll(workspaceRoot);
  promptsView.setData(result.global, result.local);
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
