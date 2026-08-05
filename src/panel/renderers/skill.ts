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
import type { Skill } from '../../types';

export function renderSkill(webview: vscode.Webview, nonce: string, skill: Skill): string {
  const warningIcon = skill.yamlError ? '⚠️ ' : '';
  const enabledBadge = badge(
    skill.enabled ? BADGE_OK : BADGE_ERROR,
    skill.enabled ? 'enabled' : 'disabled',
  );
  const error = skill.yamlError ? errorBlock('YAML Error', skill.yamlError) : '';

  const body = `
  <div class="header-row">
    <h2>${warningIcon}${escapeHtml(skill.name)}</h2>
    ${enabledBadge}
  </div>
  <div class="path">${escapeHtml(skill.path)}</div>
  <span class="type-badge">${escapeHtml(skill.source)}</span>
  ${skill.description ? `<hr><div class="label">DESCRIPTION</div><div class="desc">${escapeHtml(skill.description)}</div>` : ''}
  ${error}
  <hr>
  <div class="actions">
    <button onclick="openFile('${escapeAttr(skill.path)}')">📂 Open SKILL.md</button>
    <button onclick="copyPath('${escapeAttr(skill.path)}')">📋 Copy Path</button>
  </div>`;

  return `${htmlHead(webview, nonce)}${body}${htmlFooter(nonce)}`;
}
