# word-highlighter

コミットの書式、バージョン、タグ、CHANGELOG の規約（全プロジェクト共通）は、ここには書かない。このファイルは、このリポジトリ固有の事実だけを書く。

## 概要
サイドバーに登録した単語を、エディタ上で文字色・背景色つきで強調表示する VS Code 拡張機能。自分用で、vsix を直接インストールして使う（Marketplace には公開しない）。

## 技術スタックと主要ディレクトリ
- TypeScript / VS Code 拡張機能。実行時の依存ライブラリはない。バンドルは esbuild、型チェックは `tsc --noEmit`、lint は ESLint。
- `src/`: 本体（`extension.ts`、`store.ts`、`matcher.ts`、`decorator.ts`、`colors.ts`、`types.ts`、`sidebar/`）
- `media/`: Webview の画面とアイコン
- `test/`: `node:test` によるテスト
- `samples/word-match.txt`: 単語一致の確認用の入力
- 詳細は [docs/architecture.md](docs/architecture.md)。出力先の `dist/`、`dist-test/`、`*.vsix` は Git 管理外。

## コマンド
```bash
npm install       # 依存関係の取得（初回）
npm test          # lint + 型チェック + テストのビルド + node:test
npm run lint      # lint のみ
npm run compile   # ビルド（dist/ へ出力）
npm run package   # vsix の作成
```
- テストは VS Code を起動せずに実行できる。vscode に依存する部分（`decorator.ts`、`extension.ts`、`sidebar/provider.ts`、`media/`）は、実機で確認する。
- ※ 自動対応でコマンドを実行するには、dev-hub の `tools\claude-auto\config.ps1` の `$ExtraTools` で許可が必要。

## コーディング規約
- コメントは日本語。UI の文言・メッセージも日本語。
- vscode に依存しない処理は `store.ts`、`matcher.ts`、`sidebar/html.ts` に置き、テストできるようにする。
- テスト名の末尾の `(vX.Y.Z)` は、その挙動が確定したバージョンを表す。
- 単語一致の期待値は、VS Code の検索窓（単語一致 ON）と同じ入力で比べて決める。
- `CHANGELOG.md` の箇条書きは `*` で、文体は「です・ます」。

## バージョンの記録場所
リリースのときに、次をすべて同じコミットで更新する。
- `package.json` の `version`
- `package-lock.json` の `version`（先頭と `packages[""]` の2か所）
- `CHANGELOG.md` の見出し（`## [X.Y.Z] - YYYY-MM-DD`）

`README.md` には、現在のバージョンを書いていない（インストール手順の `X.Y.Z` は例示）。
**GitHub Releases を作るリポジトリ。** 手順は [docs/development.md](docs/development.md#リリース手順)。

## ドキュメント更新ルール
今後の開発で、次の変更を行う際は、同じ作業の中で該当ドキュメントも更新すること。
- 機能の追加・変更・削除 → `docs/spec.md`、`docs/usage.md`、`CHANGELOG.md`
- 構成や設計の変更 → `docs/architecture.md`
- 設定項目の追加・変更 → `docs/configuration.md`
- 技術選定や設計方針を変える判断 → 新しい ADR を `docs/adr/` に追加する（既存の ADR は書き換えず、ステータスを Superseded にして、新しい ADR から参照する）
- バージョンを上げるとき → `CHANGELOG.md` に新しいバージョンの節（`## [X.Y.Z] - YYYY-MM-DD`）を追加し、「バージョンの記録場所」のファイルをすべて同じコミットで更新する

## 注意事項
- 拡張機能 ID（`7QgvhP.word-highlighter`）を変えると、保存データが消える。`publisher` と `name` は変更しない。
- 表示名（`displayName`）、コマンドの分類、通知の接頭辞は `word-highlighter`。サイドバーの見出しは、ビューコンテナの `title` とビューの `name` を同じ「単語ハイライト」にしている。
- `@types/vscode` は、`engines.vscode` より新しくならないよう版を固定している（vsce がエラーにするため）。
- `.vscodeignore` で、`CLAUDE.md`、`docs/**`、`.github/**`、`src/**`、`test/**`、`samples/**` などの配布物に不要なファイルを除外している。
