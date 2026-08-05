import * as vscode from 'vscode';
import { htmlHead, htmlFooter, getNonce } from './html';
import { renderSkill } from './renderers/skill';
import { renderCommand } from './renderers/command';
import { renderAgent } from './renderers/agent';
import { renderMcp } from './renderers/mcp';
import { renderPrompt } from './renderers/prompt';
import type { DetailItem } from '../types';

export class DetailPanel implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

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
      }
    });
  }

  show(item: DetailItem): void {
    if (!this._view) return;
    this._view.show(true);
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

  private renderEmpty(webview: vscode.Webview): string {
    const nonce = getNonce();
    return `${htmlHead(webview, nonce)}<div class="empty">Select an item to view details</div>${htmlFooter(nonce)}`;
  }
}
