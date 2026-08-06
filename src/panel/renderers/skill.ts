import type * as vscode from 'vscode';
import {
  htmlHead,
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
  const editButton = skill.yamlError ? '' : `<button id="edit-btn">✏️ Edit</button>`;

  const body = `
  <div id="view-mode">
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
      <button data-action="openFile" data-path="${escapeAttr(skill.path)}">📂 Open SKILL.md</button>
      <button data-action="copyPath" data-path="${escapeAttr(skill.path)}">📋 Copy Path</button>
      ${editButton}
    </div>
  </div>
  <div id="edit-form" data-path="${escapeAttr(skill.path)}" style="display:none">
    <div class="label">NAME</div>
    <input id="edit-name" type="text" value="${escapeAttr(skill.name)}" style="width:100%;box-sizing:border-box;margin-bottom:8px;padding:4px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:2px;">
    <div class="label">DESCRIPTION</div>
    <textarea id="edit-desc" rows="4" style="width:100%;box-sizing:border-box;margin-bottom:8px;padding:4px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:2px;">${escapeHtml(skill.description)}</textarea>
    <div class="label">ENABLED</div>
    <input id="edit-enabled" type="checkbox" ${skill.enabled ? 'checked' : ''} style="margin-bottom:8px;">
    <div class="actions">
      <button id="save-btn">💾 Save</button>
      <button id="cancel-btn">✖ Cancel</button>
    </div>
  </div>`;

  const script = `<script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const form = document.getElementById('edit-form');
    function enterEdit() {
      document.getElementById('view-mode').style.display = 'none';
      document.getElementById('edit-form').style.display = 'block';
    }
    function cancelEdit() {
      document.getElementById('edit-form').style.display = 'none';
      document.getElementById('view-mode').style.display = 'block';
    }
    function saveEdit() {
      vscode.postMessage({
        command: 'editSkill',
        path: form.getAttribute('data-path'),
        name: document.getElementById('edit-name').value,
        description: document.getElementById('edit-desc').value,
        enabled: document.getElementById('edit-enabled').checked
      });
    }
    document.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', () => {
        const action = el.getAttribute('data-action');
        const path = el.getAttribute('data-path');
        if (action === 'openFile' && path) {
          vscode.postMessage({ command: 'openFile', path });
        } else if (action === 'copyPath' && path) {
          vscode.postMessage({ command: 'copyPath', path });
        }
      });
    });
    const editBtn = document.getElementById('edit-btn');
    if (editBtn) editBtn.addEventListener('click', enterEdit);
    document.getElementById('save-btn').addEventListener('click', saveEdit);
    document.getElementById('cancel-btn').addEventListener('click', cancelEdit);
  </script>
</body>
</html>`;

  return `${htmlHead(webview, nonce)}${body}${script}`;
}
