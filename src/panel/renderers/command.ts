import type * as vscode from 'vscode';
import {
  htmlHead,
  htmlFooter,
  escapeHtml,
  escapeAttr,
  errorBlock,
} from '../html';
import { truncateMiddle } from '../../util/truncate';
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
  const path = command.path ? truncateMiddle(command.path, 60) : '';
  const sourceInfo =
    command.source === 'file'
      ? `<div class="label">SOURCE</div><code title="${escapeAttr(command.path || '')}">${escapeHtml(path)}</code>`
      : `<div class="label">DEFINED IN</div><code title="${escapeAttr(command.path || '')}">${escapeHtml(path)} → ${escapeHtml(command.jsonPath || '')}</code>`;
  const openButton = command.path
    ? `<button data-action="openFile" data-path="${escapeAttr(command.path)}">${command.source === 'file' ? 'Open File' : 'Open opencode.json'}</button>`
    : '';
  const copyButton = command.path
    ? `<button data-action="copyPath" data-path="${escapeAttr(command.path)}">Copy Path</button>`
    : '';

  const body = `
  <div class="header-row">
    <h2>${escapeHtml(command.name)}</h2>
    <div class="header-badges">
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
