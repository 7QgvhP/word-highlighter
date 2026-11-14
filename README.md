# word-highlighter

サイドバーに登録した単語を、エディタ上で文字色・背景色つきで強調表示する VS Code 拡張機能。

## 概要

コードや文章の中で注目したい単語を、エディタ上で色付きで目立たせる。
単語はサイドバーで管理し、単語ごとに色・単語一致・正規表現を設定できる。
自分用で、Marketplace には公開せず、GitHub Releases の vsix を直接インストールして使う。

## 主な機能

- サイドバーの入力欄、またはエディタの右クリックメニューから単語を登録する
- 単語ごとに、有効/無効、単語一致（VS Code の検索と同じ判定）、正規表現、文字色、背景色を設定する
- 一覧の並び順で優先度を決め、重なった部分には上の単語の色だけを使う
- すべてのハイライトを、まとめてオン/オフする

## クイックスタート

前提：VS Code 1.141 以上。

[GitHub Releases](https://github.com/7QgvhP/word-highlighter/releases) から vsix をダウンロードしてインストールし、アクティビティバーの「単語ハイライト」から単語を登録する。

```bash
code --install-extension word-highlighter-X.Y.Z.vsix
```

詳しくは [docs/usage.md](docs/usage.md) を参照。

## ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/spec.md](docs/spec.md) | 仕様（何をするか） |
| [docs/usage.md](docs/usage.md) | 使用方法 |
| [docs/architecture.md](docs/architecture.md) | 設計（どう作っているか） |
| [docs/development.md](docs/development.md) | 開発者向けガイド（ビルド、テスト、リリース） |
| [docs/adr/](docs/adr/README.md) | 設計判断記録（ADR） |
| [CHANGELOG.md](CHANGELOG.md) | 変更履歴 |

## ライセンス

`UNLICENSED`（`package.json`）。LICENSE ファイルは置いていない。
