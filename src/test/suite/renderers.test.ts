import * as assert from 'assert';
import { renderSkill } from '../../panel/renderers/skill';
import { renderCommand } from '../../panel/renderers/command';
import { renderAgent } from '../../panel/renderers/agent';
import { renderMcp } from '../../panel/renderers/mcp';
import { renderPrompt } from '../../panel/renderers/prompt';
import { errorBlock } from '../../panel/html';
import type * as vscode from 'vscode';
import type { Agent, Command, McpServer, PromptItem, Skill } from '../../types';

const webview = { cspSource: 'https://example.com' } as unknown as vscode.Webview;
const NONCE = 'test-nonce';

const EMOJIS = ['📂', '📋', '✏️', '💾', '✖', '⚠️'];

const LONG_PATH = '/very/long/path/'.repeat(10) + 'SKILL.md';

const skill: Skill = {
  itemType: 'skill',
  name: 'my-skill',
  description: 'A skill',
  path: LONG_PATH,
  enabled: true,
  source: 'global',
};
const command: Command = {
  itemType: 'command',
  name: 'my-command',
  description: 'A command',
  source: 'file',
  path: LONG_PATH,
  template: 'echo hi',
};
const agent: Agent = {
  itemType: 'agent',
  name: 'my-agent',
  description: '',
  mode: 'primary',
  source: 'config',
  path: LONG_PATH,
};
const mcp: McpServer = {
  itemType: 'mcp',
  name: 'my-mcp',
  type: 'remote',
  url: 'http://127.0.0.1:1234/mcp',
  enabled: true,
  source: 'global',
  path: LONG_PATH,
};
const prompt: PromptItem = {
  itemType: 'prompt',
  name: 'my-prompt',
  kind: 'prompt',
  source: 'global',
  path: LONG_PATH,
  preview: 'You are a prompt.',
};

function assertNoEmoji(html: string): void {
  for (const emoji of EMOJIS) {
    assert.ok(!html.includes(emoji), `unexpected emoji ${emoji}`);
  }
}

suite('renderers', () => {
  test('skill renderer has no emojis', () => {
    assertNoEmoji(renderSkill(webview, NONCE, skill));
  });

  test('skill renderer truncates the path and keeps full path in title', () => {
    const html = renderSkill(webview, NONCE, skill);
    assert.ok(html.includes('…'));
    assert.ok(html.includes(`title="${LONG_PATH}"`));
  });

  test('skill renderer shows clean buttons and edit mode', () => {
    const html = renderSkill(webview, NONCE, skill);
    assert.ok(html.includes('Open SKILL.md'));
    assert.ok(html.includes('Copy Path'));
    assert.ok(html.includes('Edit'));
    assert.ok(html.includes('Save'));
    assert.ok(html.includes('Cancel'));
  });

  test('command renderer drops the redundant COMMAND badge', () => {
    const html = renderCommand(webview, NONCE, command);
    assert.ok(!html.includes('COMMAND'));
  });

  test('command renderer has no emojis and truncates path', () => {
    const html = renderCommand(webview, NONCE, command);
    assertNoEmoji(html);
    assert.ok(html.includes('…'));
  });

  test('agent renderer has no emojis and truncates path', () => {
    const html = renderAgent(webview, NONCE, agent);
    assertNoEmoji(html);
    assert.ok(html.includes('…'));
  });

  test('mcp renderer has no emojis and truncates path', () => {
    const html = renderMcp(webview, NONCE, mcp);
    assertNoEmoji(html);
    assert.ok(html.includes('…'));
  });

  test('prompt renderer keeps kind badge but drops duplicate source badge', () => {
    const html = renderPrompt(webview, NONCE, prompt);
    assert.ok(html.includes('>prompt<'));
    assert.ok(!html.includes('>global<'));
  });

  test('prompt renderer has no emojis and truncates path', () => {
    const html = renderPrompt(webview, NONCE, prompt);
    assertNoEmoji(html);
    assert.ok(html.includes('…'));
  });

  test('errorBlock has no emoji', () => {
    assertNoEmoji(errorBlock('Error', 'boom'));
  });
});
