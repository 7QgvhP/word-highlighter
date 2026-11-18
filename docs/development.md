# 開発者向けガイド

## 開発環境の構築

- Node.js と npm。GitHub Actions では Node 24 を使っている。
- 依存関係を取得する。

```bash
npm install
```

## ビルド

```bash
npm run compile   # dist/extension.js に1ファイルにまとめる（esbuild）
npm run watch     # 変更を監視してビルドする
npm run package   # vsix を作る（vsce package --skip-license。LICENSE ファイルを置かないため）
```

`npm run package` は、`word-highlighter-<バージョン>.vsix` をリポジトリの直下に作る（Git 管理外）。

## テスト

```bash
npm test
```

lint、型チェック（`tsc --noEmit`）、テストのビルド（esbuild で `dist-test/` に出力）、`node --test` を順に実行する。

- テストは `node:test` で書き、VS Code を起動せずに実行する（[ADR 0006](adr/0006-headless-tests-with-node-test.md)）。対象は vscode に依存しない `matcher.ts`、`store.ts`、`sidebar/html.ts`。
  - マッチ判定: 通常・正規表現・単語一致・日本語・空マッチのスキップ・重なりの分割・正規表現のフラグ・検索範囲
  - 保存: 検証（破損の検出）、状態の操作、破損時に保存しないこと、初期化時の退避
  - Webview の HTML: CSP と nonce、外部リソースを読み込まないこと
- テスト名の末尾の `(vX.Y.Z)` は、その挙動が確定したバージョンを表す。
- 単語一致は、VS Code の検索窓（単語一致 ON）と同じ入力で結果を比べて期待値を決める。確認用の入力は `samples/word-match.txt`。最低限、次のケースを含める。
  - `foo` と `foo_bar`、`foobar`、`foo-bar`、`foo.bar`
  - 区切り文字で始まる・終わる単語（`.foo`、`foo.`）
  - 日本語（`日本` と `日本語`、前後が空白や句読点の場合）
  - 正規表現と単語一致が両方 ON の場合
- vscode に依存する部分（`decorator.ts`、`extension.ts`、`sidebar/provider.ts`、`media/`）は、VS Code 上で動かして確認する。

## lint / フォーマット

```bash
npm run lint      # eslint src test media
```

設定は `eslint.config.mjs`（`@eslint/js` と `typescript-eslint`）。フォーマッタの設定はない。

## ブランチ運用とコミット

全プロジェクト共通の Git 運用ルールに従う。このリポジトリ固有の事情はない。

## リリース手順

1. 更新するファイルは、[CLAUDE.md](../CLAUDE.md) の「バージョンの記録場所」を参照する。
2. `v` で始まるタグを push すると、GitHub Actions（`.github/workflows/release.yml`）が次を行う。
   1. タグと `package.json` のバージョンが一致することを確認する（一致しないと失敗する）
   2. `npm ci` と `npm test`
   3. `npm run package` で vsix を作り、GitHub Releases に添付する（説明文は空。既にリリースがある場合は vsix の差し替えのみ）
3. 過去のタグをリリースし直す場合は、GitHub の Actions → release → Run workflow でタグを指定する。

- `@types/vscode` は、`engines.vscode` より新しくならないよう版を固定している（vsce がエラーにするため）。`engines.vscode` を上げるときは、あわせて見直す。
