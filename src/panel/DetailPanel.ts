import * as vscode from 'vscode';
import { htmlHead, htmlFooter, getNonce } from './html';
import { renderSkill } from './renderers/skill';
import { renderCommand } from './renderers/command';
import { renderAgent } from './renderers/agent';
import { renderMcp } from './renderers/mcp';
import { renderPrompt } from './renderers/prompt';
import { SkillEditor } from '../edit/SkillEditor';
import type { DetailItem, Skill } from '../types';

export interface DetailPanelOptions {
  onSkillEdited?: (updated: Skill) => void;
}

export class DetailPanel implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private currentSkill?: Skill;
  private readonly editor = new SkillEditor();

  constructor(private readonly options: DetailPanelOptions = {}) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [],
    };
    webviewView.webview.html = this.renderEmpty(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message) => {
      if (
        message.command === 'openFile' &&
        typeof message.path === 'string' &&
        message.path.length > 0
      ) {
        const uri = vscode.Uri.file(message.path);
        vscode.commands.executeCommand('vscode.open', uri);
      } else if (
        message.command === 'copyPath' &&
        typeof message.path === 'string' &&
        message.path.length > 0
      ) {
        vscode.env.clipboard.writeText(message.path);
        vscode.window.showInformationMessage('Path copied to clipboard');
      } else if (this.isEditSkillMessage(message)) {
        this.handleEditSkill(message);
      }
    });
  }

  show(item: DetailItem): void {
    if (!this._view) return;
    this._view.show(true);
    if (item.itemType === 'skill') {
      this.currentSkill = item;
    }
    const webview = this._view.webview;
    const nonce = getNonce();
    switch (item.itemType) {
      case 'skill':
        this._view.webview.html = renderSkill(webview, nonce, item);
        break;
      case 'command':
        this._view.webview.html = renderCommand(webview, nonce, item);
        break;
      case 'agent':
        this._view.webview.html = renderAgent(webview, nonce, item);
        break;
      case 'mcp':
        this._view.webview.html = renderMcp(webview, nonce, item);
        break;
      case 'prompt':
        this._view.webview.html = renderPrompt(webview, nonce, item);
        break;
    }
  }

  clear(): void {
    if (!this._view) return;
    this._view.webview.html = this.renderEmpty(this._view.webview);
  }

  private isEditSkillMessage(message: unknown): message is {
    command: string;
    path: string;
    name: string;
    description: string;
    enabled: boolean;
  } {
    if (!message || typeof message !== 'object') return false;
    const m = message as Record<string, unknown>;
    return (
      m.command === 'editSkill' &&
      typeof m.path === 'string' &&
      typeof m.name === 'string' &&
      typeof m.description === 'string' &&
      typeof m.enabled === 'boolean'
    );
  }

  private handleEditSkill(message: {
    path: string;
    name: string;
    description: string;
    enabled: boolean;
  }): void {
    try {
      this.editor.editSkill(message.path, {
        name: message.name,
        description: message.description,
        enabled: message.enabled,
      });
      vscode.window.showInformationMessage('Skill updated');
      if (this.currentSkill) {
        this.options.onSkillEdited?.({
          ...this.currentSkill,
          name: message.name,
          description: message.description,
          enabled: message.enabled,
        });
      }
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to update skill: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  private renderEmpty(webview: vscode.Webview): string {
    const nonce = getNonce();
    return `${htmlHead(webview, nonce)}<div class="empty">Select an item to view details</div>${htmlFooter(nonce)}`;
  }
}
