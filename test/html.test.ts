import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildHtml, createNonce } from '../src/sidebar/html';

describe('サイドバーの HTML (v1.0.0)', () => {
  const html = buildHtml({
    cspSource: 'https://example.vscode-cdn.net',
    nonce: 'abc123',
    scriptUri: 'https://example.vscode-cdn.net/media/sidebar.js',
    styleUri: 'https://example.vscode-cdn.net/media/sidebar.css',
  });

  test('CSP で既定をすべて禁止し、nonce の付いたスクリプトだけを許可する', () => {
    const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html)?.[1] ?? '';
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /script-src 'nonce-abc123'/);
    assert.match(csp, /style-src https:\/\/example\.vscode-cdn\.net(;|$)/);
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|\*/);
  });

  test('すべての script 要素に nonce が付いている', () => {
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    assert.equal(scripts.length, 1);
    for (const s of scripts) {
      assert.match(s, /nonce="abc123"/);
    }
  });

  test('外部リソースを読み込まない（拡張機能内の URI のみ）', () => {
    const urls = html.match(/(?:src|href)="([^"]+)"/g) ?? [];
    for (const u of urls) {
      assert.match(u, /"https:\/\/example\.vscode-cdn\.net\/media\//);
    }
  });

  test('nonce は毎回異なる', () => {
    assert.notEqual(createNonce(), createNonce());
  });
});
