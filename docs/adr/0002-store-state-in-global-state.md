# 0002. 状態を `globalState` に保存する

- ステータス: Accepted
- 日付: 2026-10-16（初版のリリース日）

## 背景（Context）

登録した単語、並び順、有効/無効、全体のオン/オフを、再起動後も保持する必要がある。

## 決定内容（Decision）

- `context.globalState` のキー `wordHighlighter.state` に保存する。全プロジェクト（ワークスペース）共通。
- `settings.json` には書き込まない（`contributes.configuration` を定義しない）。
- 形式バージョン `schemaVersion` を持たせ、読み込み時に移行処理を通す。破損時は保存を一切行わない。

## 理由と検討した代替案（Consequences / Alternatives）

- 拡張機能 ID（`7QgvhP.word-highlighter`）を変えると、保存データが消える。
- 検討した代替案: `workspaceState`（ワークスペースごと）、`settings.json` への保存。
