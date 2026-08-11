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
import { truncateMiddle } from '../../util/truncate';
import type { PromptItem } from '../../types';

export function renderPrompt(webview: vscode.Webview, nonce: string, item: PromptItem): string {
  const error = item.error ? errorBlock('Error', item.error) : '';
  const preview = item.error
    ? ''
    : `<div class="label">PREVIEW</div><pre>${escapeHtml(item.preview)}</pre>`;
  const path = truncateMiddle(item.path, 60);

  const body = `
  <div class="header-row">
    <h2>${escapeHtml(item.name)}</h2>
    <div class="header-badges">
      ${badge(BADGE_OK, item.kind)}
    </div>
  </div>
  <div class="path" title="${escapeAttr(item.path)}">${escapeHtml(path)}</div>
  ${error}
  ${preview}
  <hr>
  <div class="actions">
    <button data-action="openFile" data-path="${escapeAttr(item.path)}">Open File</button>
    <button data-action="copyPath" data-path="${escapeAttr(item.path)}">Copy Path</button>
  </div>`;

  return `${htmlHead(webview, nonce)}${body}${htmlFooter(nonce)}`;
}
