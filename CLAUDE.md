# word-highlighter

共通ルール（コミットの書式、バージョン、タグ、CHANGELOG）は、ここには書きません。このファイルは、このリポジトリ固有の事実だけを書きます。

## 概要
サイドバーに登録した単語を、エディタ上で文字色・背景色つきで強調表示する VS Code 拡張機能です。自分用で、vsix を直接インストールして使います（Marketplace には公開しません）。仕様書は `docs/SPEC.md` です。

## 現在の状態
- 初版 v1.0.0 を、`main` への最初のコミットとしてリリースしました（タグ `v1.0.0`、GitHub Releases に vsix を添付）。
- `main` の保護設定（force push と削除の禁止）は、dev-hub 側で行います。

## 構成と技術
- TypeScript / VS Code 拡張機能。実行時の依存ライブラリはありません。ビルドは esbuild で `dist/extension.js` に1ファイルにまとめ、型チェックは `tsc --noEmit`、lint は ESLint（`eslint.config.mjs`）で行います。
- `src/extension.ts`: 起動、コマンドの登録、各部品の接続
- `src/store.ts`: `globalState` への保存・読み込み・検証・移行と、状態を変える操作（vscode に依存しない）
- `src/matcher.ts`: マッチ判定、単語境界（VS Code の `isValidMatch` 相当）、重なりの分割、検索範囲（vscode に依存しない）
- `src/decorator.ts`: 装飾の適用、(文字色, 背景色) ごとの共有と破棄、再描画の待ち時間
- `src/colors.ts`: パレットと背景色の透明度（`BG_ALPHA`）
- `src/types.ts`: 状態と、Webview とのメッセージの型
- `src/sidebar/`: Webview ビューのプロバイダ（`provider.ts`）と HTML（`html.ts`。CSP と nonce）
- `media/`: Webview の画面（`sidebar.js`、`sidebar.css`）と、アクティビティバーのアイコン（`icon.svg`。蛍光ペンの形）
- `test/`: `node:test` によるテスト（esbuild で `dist-test/` にまとめて実行）
- `samples/word-match.txt`: 単語一致を、VS Code の検索窓と見比べるためのファイル（vsix には含めません）
- `docs/`: 仕様書
- 出力先の `dist/`、`dist-test/`、`*.vsix` は Git 管理外

## ビルド・テストの手順
```bash
npm install       # 依存関係の取得（初回）
npm test          # lint + 型チェック + テストのビルド + node:test
npm run compile   # ビルド（dist/ へ出力）
npm run package   # vsix の作成（vsce package --skip-license）
```
- テストは VS Code を起動せずに実行できます。vscode に依存する部分（`decorator.ts`、`extension.ts`、`sidebar/provider.ts`、`media/`）は、実機で確認します。
- テスト名の末尾の `(vX.Y.Z)` は、その挙動が確定したバージョンを表します。
- 単語一致の期待値は、VS Code の検索窓（単語一致ON）と同じ入力で比べて決めます。
- ※ 自動対応でコマンドを実行するには、dev-hub の `tools\claude-auto\config.ps1` の `$ExtraTools` で許可が必要です。

## バージョンの記録場所
リリースのときに、次をすべて同じコミットで更新します。
- `package.json` の `version`
- `package-lock.json` の `version`（先頭と `packages[""]` の2か所）
- `CHANGELOG.md` の見出し（`## [X.Y.Z] - YYYY-MM-DD`）

`README.md` には、現在のバージョンを書いていません（インストール手順の `X.Y.Z` は例示です）。

## 注意事項
- **GitHub Releases を作るリポジトリです。** `v` で始まるタグを push すると、`.github/workflows/release.yml` が、タグと `package.json` のバージョンの一致確認、テストの実行、vsix の作成、Releases への添付を行います。バージョンが一致しないと、リリースは失敗します。
- 拡張機能ID（`7QgvhP.word-highlighter`）を変えると、保存データが消えます。`publisher` と `name` は変更しないでください。
- 表示名（`displayName`）は、他の拡張機能にそろえて英語の `word-highlighter` にしています（コマンドの分類、通知の接頭辞も同じ）。サイドバーの見出しは、ビューコンテナの `title` とビューの `name` を同じ「単語ハイライト」にして、「単語ハイライト」とだけ表示しています。画面の文言は日本語です。
- 仕様書（`docs/SPEC.md`）は、実装に合わせて書いています。挙動を変えたときは、仕様書も同じコミットで更新してください。
- `engines.vscode` より新しい `@types/vscode` を使うと、vsce がエラーにします。`@types/vscode` は版を固定しています。
- `.vscodeignore` で、`CLAUDE.md`、`docs/**`、`.github/**`、`src/**`、`test/**`、`samples/**` などの配布物に不要なファイルを除外しています。
- `CHANGELOG.md` の箇条書きは `*` で、文体は「です・ます」です。
