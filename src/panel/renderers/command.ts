import type * as vscode from 'vscode';
import {
  htmlHead,
  htmlFooter,
  escapeHtml,
  escapeAttr,
  badge,
  BADGE_OK,
  errorBlock,
} from '../html';
import type { Command } from '../../types';

export function renderCommand(webview: vscode.Webview, nonce: string, command: Command): string {
  const error = command.error ? errorBlock('Error', command.error) : '';
  const sourceBadge =
    command.source === 'file'
      ? `<span class="badge-file">File</span>`
      : `<span class="badge-json">JSON config</span>`;
  const templateSection = command.template
    ? `<div class="label">TEMPLATE</div><pre>${escapeHtml(command.template)}</pre>`
    : '';
  const sourceInfo =
    command.source === 'file'
      ? `<div class="label">SOURCE</div><code>${escapeHtml(command.path || '')}</code>`
      : `<div class="label">DEFINED IN</div><code>${escapeHtml(command.path || '')} → ${escapeHtml(command.jsonPath || '')}</code>`;
  const openButton = command.path
    ? `<button onclick="openFile('${escapeAttr(command.path)}')">📂 ${command.source === 'file' ? 'Open File' : 'Open opencode.json'}</button>`
    : '';
  const copyButton = command.path
    ? `<button onclick="copyPath('${escapeAttr(command.path)}')">📋 Copy Path</button>`
    : '';

  const body = `
  <div class="header-row">
    <h2>${escapeHtml(command.name)}</h2>
    <div class="header-badges">
      ${badge(BADGE_OK, 'COMMAND')}
      ${sourceBadge}
    </div>
  </div>
  ${command.description ? `<div class="desc">${escapeHtml(command.description)}</div>` : ''}
  ${error}
  ${templateSection}
  <hr>
  ${sourceInfo}
  <hr>
  <div class="actions">
    ${openButton}
    ${copyButton}
  </div>`;

  return `${htmlHead(webview, nonce)}${body}${htmlFooter(nonce)}`;
}
