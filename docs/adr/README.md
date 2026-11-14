# 設計判断記録（ADR）

重要な設計判断を、1判断1ファイルで記録する。

## ファイル命名規則

`NNNN-短い題名.md`（`NNNN` は4桁の連番。題名は英小文字とハイフン）

## ステータス

| ステータス | 意味 |
|---|---|
| Proposed | 提案中 |
| Accepted | 採用済み |
| Deprecated | 廃止（後継なし） |
| Superseded | 別の ADR で置き換えられた（置き換えた ADR へのリンクを書く） |

コードや履歴から逆算した判断は、ステータスに「推定（コードから逆算）」と付記する。

## 運用

- 既存の ADR は書き換えない。判断を変えるときは新しい ADR を追加し、古い ADR のステータスを Superseded にする。

## 一覧

| 番号 | 題名 | ステータス | 日付 |
|---|---|---|---|
| [0001](0001-record-architecture-decisions.md) | ADR で設計判断を記録する | Accepted | 2026-11-15 |
| [0002](0002-store-state-in-global-state.md) | 状態を `globalState` に保存する | Accepted（推定：コードから逆算） | 2026-10-16 |
| [0003](0003-whole-word-same-as-vscode.md) | 単語一致を VS Code の検索と同じ規則にする | Accepted | 2026-10-16 |
| [0004](0004-regex-unicode-flag-only-when-needed.md) | 正規表現の `u` フラグを必要なときだけ付ける | Accepted | 2026-10-16 |
| [0005](0005-webview-is-display-only.md) | Webview を表示専用にし、状態は拡張機能側が持つ | Accepted | 2026-10-16 |
| [0006](0006-headless-tests-with-node-test.md) | テストを `node:test` で、VS Code を起動せずに行う | Accepted（推定：コードから逆算） | 2026-10-16 |
| [0007](0007-limit-search-to-visible-range.md) | 検索範囲を表示範囲の前後300行に限定する | Accepted | 2026-10-16 |

日付が 2026-10-16 のものは、初版（v1.0.0）のリリース日。判断は初版の仕様書（旧 `docs/SPEC.md`）に書かれていた。
