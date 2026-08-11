import type * as vscode from 'vscode';
import {
  htmlHead,
  htmlFooter,
  escapeHtml,
  escapeAttr,
  badge,
  BADGE_OK,
  BADGE_ERROR,
  errorBlock,
} from '../html';
import { truncateMiddle } from '../../util/truncate';
import type { McpServer } from '../../types';

export function renderMcp(webview: vscode.Webview, nonce: string, server: McpServer): string {
  const statusBadge = badge(
    server.enabled ? BADGE_OK : BADGE_ERROR,
    server.enabled ? 'enabled' : 'disabled',
  );
  const error = server.error ? errorBlock('Error', server.error) : '';
  const transport = server.url
    ? `<div class="label">URL</div><code>${escapeHtml(server.url)}</code>`
    : server.command
      ? `<div class="label">COMMAND</div><code>${escapeHtml([server.command, ...(server.args ?? [])].join(' '))}</code>`
      : '';
  const copyUrlButton = server.url
    ? `<button data-action="copyPath" data-path="${escapeAttr(server.url)}">Copy</button>`
    : '';
  const path = truncateMiddle(server.path, 60);

  const body = `
  <div class="header-row">
    <h2>${escapeHtml(server.name)}</h2>
    <div class="header-badges">
      ${statusBadge}
      ${badge(BADGE_OK, server.type)}
    </div>
  </div>
  <div class="path" title="${escapeAttr(server.path)}">${escapeHtml(path)}</div>
  ${transport}
  ${error}
  <hr>
  <div class="actions">
    <button data-action="openFile" data-path="${escapeAttr(server.path)}">Open Config</button>
    ${copyUrlButton}
    <button data-action="copyPath" data-path="${escapeAttr(server.path)}">Copy Path</button>
  </div>`;

  return `${htmlHead(webview, nonce)}${body}${htmlFooter(nonce)}`;
}
