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
import type { Agent } from '../../types';

export function renderAgent(webview: vscode.Webview, nonce: string, agent: Agent): string {
  const modeBadge = agent.mode ? badge(BADGE_OK, agent.mode) : '';
  const error = agent.error ? errorBlock('Error', agent.error) : '';
  const metaRows = [
    agent.model ? `<div class="label">MODEL</div><div class="desc">${escapeHtml(agent.model)}</div>` : '',
    agent.temperature !== undefined
      ? `<div class="label">TEMPERATURE</div><div class="desc">${escapeHtml(String(agent.temperature))}</div>`
      : '',
  ].join('');
  const toolsChips = agent.tools?.length
    ? `<div class="label">TOOLS</div><div class="chips">${agent.tools.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';
  const promptButton = agent.promptFile
    ? `<button data-action="openFile" data-path="${escapeAttr(agent.promptFile)}">Open Prompt</button>`
    : '';
  const path = truncateMiddle(agent.path, 60);

  const body = `
  <div class="header-row">
    <h2>${escapeHtml(agent.name)}</h2>
    ${modeBadge}
  </div>
  <div class="path" title="${escapeAttr(agent.path)}">${escapeHtml(path)}</div>
  ${agent.description ? `<hr><div class="label">DESCRIPTION</div><div class="desc">${escapeHtml(agent.description)}</div>` : ''}
  ${metaRows}
  ${toolsChips}
  ${error}
  <hr>
  <div class="actions">
    <button data-action="openFile" data-path="${escapeAttr(agent.path)}">Open Source File</button>
    ${promptButton}
    <button data-action="copyPath" data-path="${escapeAttr(agent.path)}">Copy Path</button>
  </div>`;

  return `${htmlHead(webview, nonce)}${body}${htmlFooter(nonce)}`;
}
