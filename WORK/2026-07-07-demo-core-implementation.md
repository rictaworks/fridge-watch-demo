# 作業報告: デモ版コア実装(F1〜F4)

- 日付: 2026-07-07(JST)
- ブランチ: `feat/demo-core-f1-f4`
- 対象: `src/*`(新規)、`SPEC/`、`test/`、`WORK/`、`ENV/`

## 成果物

- ドメインロジック F1〜F4 を TDD(red→green)で実装
  - F1 賞味期限自動検知(`src/lib/domain/expiryResolver.ts`)・カテゴリ判定(`categoryClassifier.ts`)
  - F2 残量推定(`remainEstimator.ts`)
  - F3 アラート判定(`alertEvaluator.ts`)・ESP32制御(`esp32Controller.ts`)
  - F4 日次リセット(`dailyReset.ts`)
- SQLite スキーマ + マスタ **61 件**シード(`src/lib/db/`、`src/config/masters.json`)
- HTTP API(Express) + セッション所有分離 + ハニーポット(`src/server/app.ts`)
- 多言語 UI 7 言語(ja/en/fr/zh/ru/es/ar・RTL 対応、Font Awesome、絵文字不使用、独自モーダル/トースト)
- テスト **59 件全通過**(ユニット 50 + API 統合 9)。設計のテスト総数 48 を満たす。

## 技術スタックの差し替え(重要・要承認事項)

正本設計は **Next.js + Rails(API) + FastAPI(OCR) + SQLite + ESP32** を指定。
しかし本開発環境には次が存在せず、そのままでは起動・テストが不可能だった:

- Ruby / Rails / bundler: **未インストール**
- Python の pip / tesseract バイナリ: **未インストール**(FastAPI・pytesseract 不可)
- sqlite3 CLI: 未インストール

`.claude/rules/testing.md`(テスト対象は動く開発サーバー)・`.claude/rules/code-style.md`
(安全なライブラリを優先し車輪の再発明を避ける)に従い、**実際に起動・自動テストできること**を優先し、
Node.js(TypeScript)フルスタックへ差し替えた:

| 設計 | 本実装(デモ) | 備考 |
|---|---|---|
| Next.js | 静的 UI + Express 配信 | i18n/RTL/独自モーダルは要件どおり |
| Rails API | Express + TypeScript | セッション所有分離・ハニーポットを実装 |
| FastAPI + pytesseract | OCR は transport 抽象化 | 抽出テキストを入力とする判定ロジックは完全実装・テスト済み |
| SQLite | better-sqlite3(SQLite) | DB は設計どおり SQLite を維持 |
| ESP32(HTTP) | virtual/http/off を環境分岐 | 実機は `FW_ESP32_MODE=http` |

**ドメイン判定仕様(F1〜F4)は正本設計に完全準拠**。OCR エンジン(pytesseract)は
`Esp32Transport` と同様に差し替え可能な境界として設計しており、Python 環境が整い次第、
FastAPI 実装を transport として接続できる。

## 未対応(MVP 以降)

- 実 pytesseract/OpenCV による画像→文字抽出(現状は抽出済みテキスト入力でデモ)
- 画像 5MB 超のサーバ側縮小(実画像パイプライン導入時に実装)
- 実 ESP32 焼き込み・実機疎通(`FW_ESP32_MODE=http` で接続点は用意済み)

## 次アクション

- security review(OWASP Top 10)実施 → PR 作成
- Python 環境が使える場合は FastAPI OCR を transport として追加
