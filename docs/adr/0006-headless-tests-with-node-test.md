# 0006. テストを `node:test` で、VS Code を起動せずに行う

- ステータス: Accepted
- 日付: 2026-10-16（初版のリリース日）

## 背景（Context）

VS Code 拡張機能のテストは、VS Code を起動して行う方法（`@vscode/test-electron` など）もある。

## 決定内容（Decision）

- テストは Node 標準の `node:test` で書き、esbuild で `dist-test/` にまとめてから実行する。追加のテストフレームワークは使わない。
- vscode に依存しない処理（`matcher.ts`、`store.ts`、`sidebar/html.ts`）を分け、それだけをテストする。vscode に依存する部分は VS Code 上で動かして確認する。

## 理由と検討した代替案（Consequences / Alternatives）

- テストは VS Code を起動せずに数百ミリ秒で終わり、GitHub Actions のリリース前の確認にも使える。
- 検討した代替案: vitest、`@vscode/test-electron`（VS Code を起動して行うテスト）。
