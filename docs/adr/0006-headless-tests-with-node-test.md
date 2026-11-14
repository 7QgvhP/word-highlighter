# 0006. テストを `node:test` で、VS Code を起動せずに行う

- ステータス: Accepted（推定：コードから逆算）
- 日付: 2026-10-16（初版のリリース日）

## 背景（Context）

VS Code 拡張機能のテストは、VS Code を起動して行う方法（`@vscode/test-electron` など）もある。

## 決定内容（Decision）

- テストは Node 標準の `node:test` で書き、esbuild で `dist-test/` にまとめてから実行する。追加のテストフレームワークは使わない。
- vscode に依存しない処理（`matcher.ts`、`store.ts`、`sidebar/html.ts`）を分け、それだけをテストする。vscode に依存する部分は実機で確認する。

## 理由と検討した代替案（Consequences / Alternatives）

- 理由：TODO(要確認)（記録はない。同じ構成の c-function-analyzer、c-grep-classifier にそろえた可能性がある）。
- 結果として、テストは VS Code を起動せずに数百ミリ秒で終わり、GitHub Actions のリリース前の確認にも使える。
- 検討した代替案: vitest（初版の作成中に検討された形跡がある。CHANGELOG の v1.0.1 に「vitest ではなく `node:test`」とある）。採用しなかった理由は TODO(要確認)。
