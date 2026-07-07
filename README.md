# fridge-watch-demo

スマート冷蔵庫管理(食材残量・賞味期限の自動検知)デモ版。
時刻は JST、エンコードは UTF-8。正本仕様は [`fridge-watch-demo_design_documents.md`](./fridge-watch-demo_design_documents.md)。

## 自動ログイン

- **開発環境**は認証をバイパスし、**認証済みユーザーとして自動ログイン**する(テスト可能性のため)。
  環境変数 `APP_ENV=development` / `RAILS_ENV=development` で分岐。追加操作は不要。
- **本番環境**は **Google ログイン**必須(自動ログインは無効)。
- デモ版は認証なし方針のため、セッション ID を端末識別子として自動発行し、全データのオーナーキーに用いる。

> 注: ページ一覧・API 一覧は**実装に伴って追記**する(SPEC は実装後に生成)。下記は記載フォーマット。

## ページ一覧

実装済みページを「ページ名・URL(リンク)」で漏れなく記載する。

| ページ名 | URL |
|---|---|
| _(実装後に追記)_ | |

## API 一覧

実装済み API を「タイトル・エンドポイント URL」で記載し、仕様は [`SPEC/api/`](./SPEC/) にリンクする(実装後に生成)。

| タイトル | エンドポイント URL | SPEC |
|---|---|---|
| _(実装後に追記)_ | | |

## 開発

- 開発環境: [`ENV/DEVELOPMENT.md`](./ENV/DEVELOPMENT.md)
- 本番環境: [`ENV/PRODUCTION.md`](./ENV/PRODUCTION.md)
- 開発ルール: [`CLAUDE.md`](./CLAUDE.md) と [`.claude/rules/`](./.claude/rules/)
- 標準リファレンス: [`.claude/`](./.claude/) — 開発原則 / 品質(QC10) / テスト(TM) / セキュリティ(OWASP10) / コンプライアンス(CC) / デザイン(CRAP)
