# リバースエンジニアリング図(実装追随)

コードを正とした図。対象ブランチ: `feat/rebuild-canonical-stack`。
実装スタックは**正本設計 §1.3 に完全準拠**する3層構成へ再構築した:

- フロントエンド: **Next.js**(`src/frontend/`、App Router / TypeScript、7言語 i18n・ar は RTL)
- バックエンド: **Ruby on Rails(API モード)**(`src/backend/`、SQLite、認証なし)
- 画像解析 OCR: **FastAPI + pytesseract + OpenCV**(`src/ocr/`、ローカル tesseract のみ・外部API不使用)
- DB: **SQLite**(デモ版指定)

ドメインロジック(F1〜F4)の判定仕様は正本設計に完全準拠する。

## 1. システム構成図(3層 + デバイス)

```mermaid
flowchart LR
    U([利用者]) -->|パッケージ写真| FE
    subgraph Frontend["Next.js (src/frontend)"]
        FE[写真アップロード/一覧/残量補正<br>i18n 7言語・RTL]
    end
    subgraph Backend["Rails API (src/backend)"]
        API[Api::ItemsController ほか]
        SVC[FridgeService / FoodRepo<br>domain: F1〜F4]
        DB[(SQLite<br>session_id 所有分離)]
    end
    subgraph Ocr["FastAPI (src/ocr)"]
        OCR[OpenCV 前処理 → pytesseract<br>jpn+eng]
    end
    FE -->|/api multipart 画像| API
    API --> SVC
    SVC --> DB
    SVC -->|画像転送| OCR
    OCR -->|抽出テキスト| SVC
    SVC -->|Wi-Fi HTTP| ESP([ESP32 LED+ファン])
```

## 2. ER 図(実装テーブル)

```mermaid
erDiagram
    SESSIONS ||--o{ FOOD_ITEMS : owns
    SESSIONS ||--o{ REMAIN_ADJUSTMENTS : owns
    SESSIONS ||--o{ ALERT_LOGS : owns
    FOOD_ITEMS ||--o{ REMAIN_ADJUSTMENTS : has
    CATEGORIES ||--o{ FOOD_ITEMS : classifies
    CATEGORIES ||--|| DEFAULT_EXPIRY_MASTER : default
    CATEGORIES ||--|| CONSUMPTION_RATE_MASTER : rate
    CATEGORIES ||--o{ CATEGORY_KEYWORDS : dict
    ALERT_LEVEL_MASTER ||--o{ ALERT_LOGS : level

    SESSIONS { string session_id PK "端末識別子(推測困難な乱数)" datetime created_at datetime last_accessed_at }
    FOOD_ITEMS { int id PK string session_id FK int category_id FK string name date expiry_date bool is_estimated datetime registered_at }
    REMAIN_ADJUSTMENTS { int id PK int food_item_id FK string session_id FK int adjusted_percent datetime adjusted_at }
    ALERT_LOGS { int id PK string session_id FK int level_id FK datetime fired_at bool fan_activated }
    CATEGORIES { int id PK string key string name "8件" }
    DEFAULT_EXPIRY_MASTER { int category_id PK int default_days "8件" }
    CONSUMPTION_RATE_MASTER { int category_id PK int percent_per_day "8件" }
    CATEGORY_KEYWORDS { int id PK int category_id FK string keyword "24件" }
    DATE_PATTERN_MASTER { int id PK string regex int priority string kind "6件" }
    ALERT_LEVEL_MASTER { int id PK string key int min_days string led_color "3件" }
    ESP32_COMMAND_MASTER { int id PK string level_key string command int fan_seconds "4件" }
```

マスタ合計 8+8+8+24+6+3+4 = **61 件**(`src/backend/db/seeds.rb` が `config/masters.json` から冪等投入)。

## 3. クラス図(Rails ドメイン/サービス)

```mermaid
classDiagram
    class Api_ItemsController { +create() +manual() +adjust() +destroy() }
    class SessionManager { +ensure(cookieId, now) session_id }
    class FridgeService { +register_from_ocr() +register_manual() +adjust() +remove() +view() }
    class FoodRepo { <<所有スコープ強制>> +items() +get() +delete() +add_adjustment() }
    class OcrClient { <<F1>> +extract(image) text : FastAPI連携 }
    class ExpiryResolver { <<F1>> 日付抽出/年補完/2年超棄却/消費期限優先/既定補完 }
    class CategoryClassifier { <<F1>> キーワード辞書照合 }
    class RemainEstimator { <<F2>> 経過日数×消費率/クランプ/補充推奨 }
    class AlertEvaluator { <<F3>> 最小残日数→レベル }
    class Esp32Controller { <<F3>> 3回リトライ/クールダウン10分/ファン30秒 }
    class DailyReset { <<F4>> リセット排他/リセット中応答 }

    Api_ItemsController --> FridgeService
    Api_ItemsController --> SessionManager
    FridgeService --> FoodRepo
    FridgeService --> OcrClient
    FridgeService --> ExpiryResolver
    FridgeService --> CategoryClassifier
    FridgeService --> RemainEstimator
    FridgeService --> AlertEvaluator
    FridgeService --> Esp32Controller
```

## 4. シーケンス図(写真登録〜OCR〜ESP32制御)

```mermaid
sequenceDiagram
    actor User as 利用者
    participant FE as Next.js
    participant API as Rails(/api/items)
    participant SVC as FridgeService
    participant OCR as FastAPI(pytesseract)
    participant DB as SQLite
    participant DEV as ESP32(virtual/http/off)

    User->>FE: パッケージ写真をアップロード
    FE->>API: POST /api/items (multipart 画像, Cookie fw_session, honeypot)
    API->>API: リセット窓判定(該当時 503)
    API->>API: SessionManager.ensure(cookie)
    alt ハニーポットに入力あり
        API-->>FE: 現状ビュー(破棄, 成否を秘匿)
    else 正常
        API->>SVC: register_from_ocr(image)
        SVC->>OCR: 画像転送(5MB超は縮小)
        OCR->>OCR: OpenCV前処理→pytesseract(jpn+eng)
        OCR-->>SVC: 抽出テキスト
        SVC->>SVC: classify + resolve_expiry(年補完/2年超棄却/既定補完)
        SVC->>DB: food_items 追加(session_id 付与)
        SVC->>SVC: estimate_remain(全食材) + evaluate_alert(最小残日数)
        SVC->>DEV: send(command, fan)
        alt 送信失敗
            SVC->>DEV: 最大3回リトライ
            SVC-->>API: deviceConnected=false(表示継続)
        end
        SVC->>DB: alert_logs 追加(fan_activated)
        SVC-->>API: items + alert
        API-->>FE: JSON(残量/推定/補充推奨/LED/ファン)
    end
```

## 5. 状態遷移図(アラートレベル + デバイス)

```mermaid
stateDiagram-v2
    [*] --> off : 食材0件
    off --> safe : 残4日以上
    safe --> warning : 残1〜3日
    warning --> danger : 当日以下/期限切れ
    danger --> off : 全削除/JST03:00リセット
    safe --> off : 全削除/リセット
    warning --> off : 全削除/リセット

    state ESP32 {
        [*] --> LED_OFF
        LED_OFF --> LED_GREEN : safe
        LED_GREEN --> LED_YELLOW : warning
        LED_YELLOW --> LED_RED_FAN : danger(クールダウン外)
        LED_RED_FAN --> LED_RED_FAN : クールダウン中は再ファンなし
    }
```

## 6. API 一覧(Rails)

| メソッド | パス | 概要 |
|---|---|---|
| GET | `/api/state` | 自セッションの一覧+残量+アラート |
| POST | `/api/items` | 写真(multipart)→OCR→登録(F1)。`ocrText` 直接入力も可。空は `needManual` |
| POST | `/api/items/manual` | 手動登録(OCR失敗フォールバック) |
| POST | `/api/items/:id/adjust` | 残量手動補正(F2)。他セッションは404 |
| DELETE | `/api/items/:id` | 削除。他セッションは404 |
| POST | `/api/reset` | 手動リセット(自セッションのみ削除)。全セッション全削除は JST03:00 のみ |
| GET | `/api/masters` | カテゴリ/対応言語/RTL言語 |
| GET | `/api/device` | 仮想デバイス状態(LED/ファン) |

全 `/api` はセッションIDスコープで動作し、日次リセット中は 503 `resetting` を返す。
