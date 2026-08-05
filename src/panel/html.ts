import * as vscode from 'vscode';

export function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function getCsp(webview: vscode.Webview, nonce: string): string {
  return `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;`;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

export function badge(style: string, text: string): string {
  return `<span style="${style}">${escapeHtml(text)}</span>`;
}

export const BADGE_OK =
  'background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);padding:1px 6px;border-radius:8px;font-size:10px';
export const BADGE_ERROR =
  'background:var(--vscode-inputValidation-errorBackground);color:var(--vscode-inputValidation-errorForeground);padding:1px 6px;border-radius:8px;font-size:10px';

export function errorBlock(label: string, message: string): string {
  return `<div style="margin-top:8px;padding:8px;background:var(--vscode-inputValidation-errorBackground);border:1px solid var(--vscode-inputValidation-errorBorder);border-radius:4px;font-size:11px"><strong>⚠️ ${escapeHtml(label)}:</strong> ${escapeHtml(message)}</div>`;
}

export function htmlHead(webview: vscode.Webview, nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${getCsp(webview, nonce)}">
  <title>Details</title>
  <style>
    body { padding: 12px; color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); background: var(--vscode-editor-background); }
    h2 { margin: 0 0 4px 0; font-size: 14px; font-weight: 600; }
    .path { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; word-break: break-all; }
    .desc { font-size: 12px; color: var(--vscode-foreground); margin-bottom: 12px; line-height: 1.4; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    button { padding: 3px 10px; border: none; border-radius: 2px; cursor: pointer; font-size: 11px; font-family: var(--vscode-font-family); background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 8px; flex-wrap: wrap; }
    .header-badges { display: flex; gap: 4px; }
    .type-badge { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 1px 6px; border-radius: 8px; font-size: 10px; }
    .badge-file { background: #2d5f2d; color: #89d185; padding: 1px 6px; border-radius: 8px; font-size: 10px; }
    .badge-json { background: #5a3d1e; color: #e8ab5e; padding: 1px 6px; border-radius: 8px; font-size: 10px; }
    hr { border: none; border-top: 1px solid var(--vscode-sideBarSectionHeader-border); margin: 8px 0; }
    .label { font-size: 10px; text-transform: uppercase; color: var(--vscode-descriptionForeground); letter-spacing: 0.5px; margin-bottom: 4px; }
    pre { background: var(--vscode-textBlockQuote-background); padding: 12px; border-radius: 4px; font-size: 11px; color: var(--vscode-foreground); max-height: 200px; overflow-y: auto; white-space: pre-wrap; line-height: 1.4; margin: 0 0 12px; }
    code { font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; color: var(--vscode-textPreformat-foreground); word-break: break-all; }
    .chips { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 12px; }
    .chip { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 1px 6px; border-radius: 8px; font-size: 10px; }
    .empty { display: flex; align-items: center; justify-content: center; min-height: 60px; color: var(--vscode-descriptionForeground); font-size: 12px; }
  </style>
</head>
<body>`;
}

export function htmlFooter(nonce: string): string {
  return `<script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function openFile(path) { vscode.postMessage({ command: 'openFile', path }); }
    function copyPath(path) { vscode.postMessage({ command: 'copyPath', path }); }
  </script>
</body>
</html>`;
}
