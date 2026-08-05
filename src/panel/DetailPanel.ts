import * as vscode from 'vscode';
import type { Skill, Command } from '../types';

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
    webviewView.webview.html = this.getEmptyHtml(webviewView.webview);
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

  showSkill(skill: Skill): void {
    if (!this._view) return;
    this._view.show(true);
    this._view.webview.html = this.getSkillHtml(this._view.webview, skill);
  }

  showCommand(command: Command): void {
    if (!this._view) return;
    this._view.show(true);
    this._view.webview.html = this.getCommandHtml(this._view.webview, command);
  }

  clear(): void {
    if (!this._view) return;
    this._view.webview.html = this.getEmptyHtml(this._view.webview);
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private getCsp(webview: vscode.Webview, nonce: string): string {
    return `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;`;
  }

  private getEmptyHtml(webview: vscode.Webview): string {
    const nonce = this.getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${this.getCsp(webview, nonce)}">
  <title>Details</title>
  <style>
    body {
      padding: 12px;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      background: var(--vscode-editor-background);
    }
    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 60px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="empty">Select a skill or command to view details</div>
</body>
</html>`;
  }

  private getSkillHtml(webview: vscode.Webview, skill: Skill): string {
    const nonce = this.getNonce();
    const warningIcon = skill.yamlError ? '⚠️ ' : '';
    const enabledBadge = skill.enabled
      ? '<span style="background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);padding:1px 6px;border-radius:8px;font-size:10px">enabled</span>'
      : '<span style="background:var(--vscode-inputValidation-errorBackground);color:var(--vscode-inputValidation-errorForeground);padding:1px 6px;border-radius:8px;font-size:10px">disabled</span>';

    const errorBlock = skill.yamlError
      ? `<div style="margin-top:8px;padding:8px;background:var(--vscode-inputValidation-errorBackground);border:1px solid var(--vscode-inputValidation-errorBorder);border-radius:4px;font-size:11px"><strong>⚠️ YAML Error:</strong> ${this.escapeHtml(skill.yamlError)}</div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${this.getCsp(webview, nonce)}">
  <title>Details</title>
  <style>
    body {
      padding: 12px;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      background: var(--vscode-editor-background);
    }
    h2 {
      margin: 0 0 4px 0;
      font-size: 14px;
      font-weight: 600;
    }
    .path {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      word-break: break-all;
    }
    .desc {
      font-size: 12px;
      color: var(--vscode-foreground);
      margin-bottom: 12px;
      line-height: 1.4;
    }
    .actions {
      display: flex;
      gap: 8px;
    }
    button {
      padding: 3px 10px;
      border: none;
      border-radius: 2px;
      cursor: pointer;
      font-size: 11px;
      font-family: var(--vscode-font-family);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .source-badge {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 1px 6px;
      border-radius: 8px;
      font-size: 10px;
    }
    .badge-file {
      background: #2d5f2d;
      color: #89d185;
      padding: 1px 6px;
      border-radius: 8px;
      font-size: 10px;
      margin-left: 4px;
    }
    .badge-json {
      background: #5a3d1e;
      color: #e8ab5e;
      padding: 1px 6px;
      border-radius: 8px;
      font-size: 10px;
      margin-left: 4px;
    }
    hr {
      border: none;
      border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
      margin: 8px 0;
    }
    .label {
      font-size: 10px;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    pre {
      background: var(--vscode-textBlockQuote-background);
      padding: 12px;
      border-radius: 4px;
      font-size: 11px;
      color: var(--vscode-foreground);
      max-height: 200px;
      overflow-y: auto;
      white-space: pre-wrap;
      line-height: 1.4;
      margin: 0 0 12px;
    }
  </style>
</head>
<body>
  <div class="header-row">
    <h2>${warningIcon}${this.escapeHtml(skill.name)}</h2>
    ${enabledBadge}
  </div>
  <div class="path">${this.escapeHtml(skill.path)}</div>
  <span class="source-badge">${skill.source}</span>
  ${skill.description ? `<hr><div class="label">DESCRIPTION</div><div class="desc">${this.escapeHtml(skill.description)}</div>` : ''}
  ${errorBlock}
  <hr>
  <div class="actions">
    <button onclick="openFile('${this.escapeAttr(skill.path)}')">📂 Open SKILL.md</button>
    <button onclick="copyPath('${this.escapeAttr(skill.path)}')">📋 Copy Path</button>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function openFile(path) { vscode.postMessage({ command: 'openFile', path }); }
    function copyPath(path) { vscode.postMessage({ command: 'copyPath', path }); }
  </script>
</body>
</html>`;
  }

  private getCommandHtml(webview: vscode.Webview, command: Command): string {
    const nonce = this.getNonce();
    const errorBlock = command.error
      ? `<div style="margin-top:8px;padding:8px;background:var(--vscode-inputValidation-errorBackground);border:1px solid var(--vscode-inputValidation-errorBorder);border-radius:4px;font-size:11px"><strong>⚠️ Error:</strong> ${this.escapeHtml(command.error)}</div>`
      : '';

    const sourceBadge =
      command.source === 'file'
        ? `<span class="badge-file">File</span>`
        : `<span class="badge-json">JSON config</span>`;

    const templateSection = command.template
      ? `<div class="label">TEMPLATE</div><pre>${this.escapeHtml(command.template)}</pre>`
      : '';

    const sourceInfo =
      command.source === 'file'
        ? `<div class="label">SOURCE</div><code style="font-size:11px;color:var(--vscode-textPreformat-foreground);word-break:break-all;">${this.escapeHtml(command.path || '')}</code>`
        : `<div class="label">DEFINED IN</div><code style="font-size:11px;color:var(--vscode-textPreformat-foreground);word-break:break-all;">${this.escapeHtml(command.path || '')} → ${this.escapeHtml(command.jsonPath || '')}</code>`;

    const openButton = command.path
      ? `<button onclick="openFile('${this.escapeAttr(command.path)}')">📂 ${command.source === 'file' ? 'Open File' : 'Open opencode.json'}</button>`
      : '';

    const copyButton = command.path
      ? `<button onclick="copyPath('${this.escapeAttr(command.path)}')">📋 Copy Path</button>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${this.getCsp(webview, nonce)}">
  <title>Details</title>
  <style>
    body {
      padding: 12px;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      background: var(--vscode-editor-background);
    }
    h2 {
      margin: 0 0 4px 0;
      font-size: 14px;
      font-weight: 600;
    }
    .path {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      word-break: break-all;
    }
    .desc {
      font-size: 12px;
      color: var(--vscode-foreground);
      margin-bottom: 12px;
      line-height: 1.4;
    }
    .actions {
      display: flex;
      gap: 8px;
    }
    button {
      padding: 3px 10px;
      border: none;
      border-radius: 2px;
      cursor: pointer;
      font-size: 11px;
      font-family: var(--vscode-font-family);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .type-badge {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 1px 6px;
      border-radius: 8px;
      font-size: 10px;
    }
    .badge-file {
      background: #2d5f2d;
      color: #89d185;
      padding: 1px 6px;
      border-radius: 8px;
      font-size: 10px;
      margin-left: 4px;
    }
    .badge-json {
      background: #5a3d1e;
      color: #e8ab5e;
      padding: 1px 6px;
      border-radius: 8px;
      font-size: 10px;
      margin-left: 4px;
    }
    hr {
      border: none;
      border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
      margin: 8px 0;
    }
    .label {
      font-size: 10px;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    pre {
      background: var(--vscode-textBlockQuote-background);
      padding: 12px;
      border-radius: 4px;
      font-size: 11px;
      color: var(--vscode-foreground);
      max-height: 200px;
      overflow-y: auto;
      white-space: pre-wrap;
      line-height: 1.4;
      margin: 0 0 12px;
    }
    code {
      font-family: var(--vscode-editor-font-family, monospace);
    }
  </style>
</head>
<body>
  <div class="header-row">
    <h2>${this.escapeHtml(command.name)}</h2>
    <div>
      <span class="type-badge">COMMAND</span>
      ${sourceBadge}
    </div>
  </div>
  ${command.description ? `<div class="desc">${this.escapeHtml(command.description)}</div>` : ''}
  ${errorBlock}
  ${templateSection}
  <hr>
  ${sourceInfo}
  <hr>
  <div class="actions">
    ${openButton}
    ${copyButton}
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function openFile(path) { vscode.postMessage({ command: 'openFile', path }); }
    function copyPath(path) { vscode.postMessage({ command: 'copyPath', path }); }
  </script>
</body>
</html>`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private escapeAttr(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'");
  }
}
