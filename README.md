# word-highlighter

サイドバーに登録した単語を、エディタ上で文字色・背景色つきで強調表示する VS Code 拡張機能です。
自分用で、Marketplace には公開していません。

## インストール

[GitHub Releases](https://github.com/7QgvhP/word-highlighter/releases) から vsix をダウンロードし、次のコマンドでインストールします（VS Code の拡張機能ビューの「…」→「VSIX からのインストール」でも可）。

```bash
code --install-extension word-highlighter-X.Y.Z.vsix
```

## 使い方

- アクティビティバーの「単語ハイライト」（蛍光ペンのアイコン）を開き、入力欄に単語を入力して、Enter（または「登録」）で登録します。
- エディタの右クリックメニューの「選択テキストを登録」でも登録できます（選択がないときは、カーソル位置の単語）。
- 一覧の各行で、有効/無効（目のアイコン）、単語一致、正規表現、文字色、背景色の変更と、削除ができます。
- 行の左端のハンドルをドラッグして並べ替えます。上にある単語ほど優先され、重なった部分には上の単語の色だけが使われます。
- ビューのタイトルバーのボタン（またはコマンド「全体のオン/オフ切り替え」）で、すべてのハイライトをまとめてオン/オフできます。
- 大文字小文字は常に区別します。単語一致は、VS Code の検索の単語一致（`editor.wordSeparators`）と同じ判定です。

## 開発

```bash
npm install       # 依存関係の取得（初回）
npm test          # lint + 型チェック + テスト（node:test）
npm run compile   # ビルド（dist/ へ出力）
npm run package   # vsix の作成
```

仕様は [docs/SPEC.md](docs/SPEC.md)、変更履歴は [CHANGELOG.md](CHANGELOG.md) を参照してください。
