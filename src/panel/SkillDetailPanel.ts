import * as vscode from 'vscode';
import type { Skill } from '../types';

export class SkillDetailPanel implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
    };
    webviewView.webview.html = this.getEmptyHtml();
    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.command === 'openFile') {
        const uri = vscode.Uri.file(message.path);
        vscode.commands.executeCommand('vscode.open', uri);
      } else if (message.command === 'copyPath') {
        vscode.env.clipboard.writeText(message.path);
        vscode.window.showInformationMessage('Path copied to clipboard');
      }
    });
  }

  showSkill(skill: Skill): void {
    if (!this._view) return;
    this._view.show(true);
    this._view.webview.html = this.getSkillHtml(skill);
  }

  clear(): void {
    if (!this._view) return;
    this._view.webview.html = this.getEmptyHtml();
  }

  private getEmptyHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Skill Details</title>
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
  <div class="empty">Select a skill to view details</div>
</body>
</html>`;
  }

  private getSkillHtml(skill: Skill): string {
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
  <title>Skill Details</title>
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
  <script>
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
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
}
