# 開発環境 (DEVELOPMENT)

時刻は JST、エンコードは UTF-8。環境変数は `.env`(テンプレは `.env.example`)を参照する。

## 構成

| サービス | 技術 | ローカル URL |
|---|---|---|
| フロント | Next.js | http://localhost:3000 |
| バックエンド API | Rails | http://localhost:3001 |
| OCR | FastAPI (pytesseract + OpenCV) | http://localhost:8000 |
| DB | SQLite | `db/development.sqlite3` |

## 認証

- 開発環境は **認証済みユーザーへ分岐**(テスト可能性のため)。Google ログインは本番のみ。
- 環境判定は `APP_ENV` / `RAILS_ENV` で行い、分岐を必ず実装する。

## セットアップ(整備後に追記)

```bash
cp .env.example .env      # 値を編集（実値は commit しない）
# フロント:   cd src/frontend && npm install && npm run dev
# バックエンド: cd src/backend && bundle install && bin/rails s -p 3001
# OCR:        cd src/ocr && pip install -r requirements.txt && uvicorn main:app --reload
```

## 動作確認

`curl` / `wget --mirror` / Playwright を使用(`.claude/rules/testing.md`)。

## ツール

- mermaid CLI(図の生成): `npm i -D @mermaid-js/mermaid-cli`(Node プロジェクト作成後に導入)。

## デモ版コア実装の起動(現行 `src/`)

> 本開発環境には Ruby/Rails・Python pip・tesseract が未導入のため、デモ版コアは
> **Node.js(TypeScript)フルスタック**で実装している(経緯は `../WORK/2026-07-07-demo-core-implementation.md`)。
> DB は設計どおり SQLite を維持。OCR エンジン(pytesseract)と ESP32 は差し替え可能な境界として設計。

```bash
cd src
npm install
npm test            # ユニット+API統合(59件)
npm run dev         # http://localhost:3000 で起動(ts-node)
# 本番相当: npm run build && npm start
```

環境変数(`.env` 参照):

| 変数 | 既定 | 用途 |
|---|---|---|
| `PORT` | 3000 | 待受ポート |
| `FW_DB_PATH` | `src/data/fridge.db` | SQLite 保存先(`:memory:` 可) |
| `FW_ESP32_MODE` | `virtual` | `virtual`(画面デモ)/`http`(実機)/`off`(未接続再現) |
| `NODE_ENV` | - | `production` で Cookie を Secure に分岐 |

日次リセットは JST 03:00 に内蔵スケジューラが実行する(外部依存なし)。
