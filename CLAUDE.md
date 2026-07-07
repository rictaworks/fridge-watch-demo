# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

本リポジトリの恒久ルール。詳細は `.claude/rules/` に分割し、自動ロードされる。時刻は **JST**、エンコードは **UTF-8** で統一する。

## プロジェクト概要

- 製品: `fridge-watch-demo`(スマート冷蔵庫管理 — 食材残量・賞味期限の自動検知)
- 現行エディション: **デモ版**。正本仕様は `fridge-watch-demo_design_documents.md`(読み取り専用 444)。
- SPEC は `SPEC/` で管理・更新する(仕様書 + リバースエンジニアリング図)。

## 安全ルール(最優先・全会話で厳守)

### 削除系コマンドの禁止

- ファイル/ディレクトリを削除するコマンドを一切生成しない(`rm`, `rm -rf`, `rmdir`, `unlink`, `git clean -df`, `find -delete`, `rsync --delete`, `lftp mirror --delete` 等)。
- 削除が必要なら「手動で削除してください」と説明に留める。削除の推奨・自動判断も禁止。
- `ssh` / `lftp` / デプロイ系スクリプトでも削除コマンドは生成しない。
- 不要物は削除せず `DELETE/`(ゴミ箱)へ移動する。

### シークレット管理

- `config/master.key` 等の機密ファイルを `git add` するコードを生成しない。
- シークレットは必ず環境変数(`RAILS_MASTER_KEY` 等)で渡す。**環境変数は `.env` を参照する**。
- `.gitignore` への追加確認手順を必ずコードに含める。初回コミット前に `git status` でステージング確認を促す。

## ブランチ / PR 運用

- **`main` ブランチでの作業禁止。**
- `src/*` 以外(ドキュメント・設定・SPEC 等)は `main` への push を許可する。
- **`src/*` の変更は必ず PR を作成する**。PR は日本語で書き、非エンジニア向けユーザーテスト手順を丁寧に記載する(`.claude/rules/workflow.md`)。
- **commit する前に必ず security review**(OWASP Top 10 = `.claude/OWASP10.md`)を実施する。

## 開発原則

- **TDD 厳守**: `plan → red test → coding → green test`(RSpec / Jest 等)。詳細は `.claude/rules/testing.md`。
- **フォールバック禁止**。例外処理をしっかり書く。デバッグトレース可能なコードにする。
- 制御構文・条件構文以外はクラスまたは関数に書く。**グローバル変数禁止**(セキュリティ)。
- **文字列リテラルは設定ファイル/DB に分離**する。ハードコードを検出するテストを書く。
- ネイティブ `alert()` / `confirm()` / `prompt()` はプロジェクト全体で **使用禁止**。
- デフォルトアイコンは **Font Awesome** を使用。**絵文字禁止**。
- 環境判定を必ず実装し分岐可能にする。**テスト用に開発環境は認証済みへ分岐**する。

### 標準リファレンス(`.claude/`)

作業時に参照する既存の基準集:

- `.claude/development-principles.md` — 開発原則(YAGNI/KISS/DRY/SOLID・セキュリティ)
- `.claude/QC10.md` — 品質管理チェック10項目
- `.claude/TM.md` — テストメソッド/フレームワーク概要
- `.claude/OWASP10.md` — セキュリティレビュー(OWASP Top 10)
- `.claude/CC.md` — コンプライアンスチェック10項目
- `.claude/CRAP.md` — デザイン4原則(Contrast/Repetition/Alignment/Proximity)

## ディレクトリ運用

| ディレクトリ | 用途 |
|---|---|
| `TASKS/` | タスク管理 |
| `DEBUG/` | バグ報告 |
| `CLIENT/` | クライアント要望 |
| `WORK/` | 作業報告 |
| `ENV/` | `DEVELOPMENT.md`(開発環境)/ `PRODUCTION.md`(本番環境) |
| `SPEC/` | 仕様書・リバースエンジニアリング図(mermaid) |
| `app-ui/` | 事前デザイン指定のモック(あれば従う) |
| `test/` | テスト。PR 単位は `test/pr<番号>/` に配置。対象は開発サーバー。 |
| `DELETE/` | ゴミ箱(削除の代替) |

図解は mermaid で記述する(`.claude/rules/` 参照)。

## フロント動作確認

`curl` / `wget --mirror` / Playwright で確認する。詳細は `.claude/rules/testing.md`。

## 技術・アーキテクチャ

- 詳細は `.claude/rules/architecture.md` / `.claude/rules/i18n.md`。
- 基本は **Next.js + Rails + PostgreSQL**。ただし**デモ版は設計資料に従い SQLite / 認証なし**(`fridge-watch-demo_design_documents.md`)。
- 解析・画像加工は FastAPI、高速並列/リアルタイムは Gin を必要に応じて併用。
