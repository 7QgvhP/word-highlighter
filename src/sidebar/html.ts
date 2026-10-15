/*
 * サイドバー（Webview）の HTML を作る。
 * vscode モジュールに依存しないため、VS Code を起動せずにテストできる。
 */
import { randomBytes } from 'node:crypto';

export type HtmlParams = {
  /** webview.cspSource */
  cspSource: string;
  /** スクリプトに付ける nonce */
  nonce: string;
  /** media/sidebar.js の Webview 用 URI */
  scriptUri: string;
  /** media/sidebar.css の Webview 用 URI */
  styleUri: string;
};

/** nonce を作る */
export function createNonce(): string {
  return randomBytes(16).toString('base64');
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Webview の HTML を作る。
 * CSP で外部リソースを禁止し、スクリプトは nonce の付いたものだけを実行する。
 * スタイルは拡張機能内の CSS ファイルのみ（色などは、スクリプトから CSSOM で設定する）。
 */
export function buildHtml(p: HtmlParams): string {
  const csp = [
    "default-src 'none'",
    `style-src ${p.cspSource}`,
    `script-src 'nonce-${p.nonce}'`,
  ].join('; ');
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${escapeAttr(csp)}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${escapeAttr(p.styleUri)}">
<title>登録単語</title>
</head>
<body>
<div id="banners"></div>
<div class="add-row">
  <input id="new-word" type="text" placeholder="登録する単語" aria-label="登録する単語" spellcheck="false">
  <button id="add-button" class="text-button" type="button">登録</button>
</div>
<div id="add-error" class="add-error" role="alert"></div>
<div class="section-container">
  <div class="section-title">
    <span>単語一覧</span>
    <span class="section-actions">
      <span id="count" class="section-count"></span>
      <button id="delete-all" class="section-button" type="button">すべて削除</button>
    </span>
  </div>
  <ul id="list" class="word-list"></ul>
  <div id="empty" class="no-data">単語が登録されていません。</div>
</div>
<script nonce="${escapeAttr(p.nonce)}" src="${escapeAttr(p.scriptUri)}"></script>
</body>
</html>`;
}
