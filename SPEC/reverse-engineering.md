# リバースエンジニアリング図(実装追随)

コードを正とした図。対象コミット: フィーチャーブランチ `feat/demo-core-f1-f4`(F1〜F4 デモ実装)。
実装スタックは環境制約により **TypeScript(Node.js)フルスタック**へ差し替え(理由は `../WORK/2026-07-07-demo-core-implementation.md` / `../ENV/DEVELOPMENT.md`)。
ドメインロジック(F1〜F4)の判定仕様は正本設計に完全準拠する。

## 1. ER 図(実装テーブル)

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

    SESSIONS { string session_id PK "端末識別子" datetime created_at datetime last_accessed_at }
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

マスタ合計 8+8+8+24+6+3+4 = **61 件**(`src/config/masters.json`、`test/unit/seed.test.ts` で担保)。

## 2. コンポーネント / クラス図(実装モジュール)

```mermaid
classDiagram
    class buildApp { +Express アプリ構築 }
    class SessionManager { +ensure(cookieId, now) session_id }
    class FridgeService { +registerFromOcr() +registerManual() +adjust() +remove() +view() }
    class FoodRepo { +insertItem() +listItems() +getItem() +deleteItem() +insertAdjustment() +latestAdjustment() +lastFanAt() }
    class resolveExpiry { <<F1>> 日付抽出/年補完/2年超棄却/消費期限優先/既定補完 }
    class classifyCategory { <<F1>> キーワード辞書照合 }
    class estimateRemain { <<F2>> 経過日数×消費率/クランプ/補充推奨 }
    class evaluateAlert { <<F3>> 最小残日数→レベル }
    class sendToEsp32 { <<F3>> 3回リトライ/クールダウン10分/ファン30秒 }
    class ResetGate { <<F4>> リセット排他/リセット中応答 }

    buildApp --> SessionManager
    buildApp --> FridgeService
    buildApp --> ResetGate
    FridgeService --> FoodRepo
    FridgeService --> resolveExpiry
    FridgeService --> classifyCategory
    FridgeService --> estimateRemain
    FridgeService --> evaluateAlert
    FridgeService --> sendToEsp32
```

## 3. シーケンス図(食材登録〜ESP32制御)

```mermaid
sequenceDiagram
    actor User as 利用者
    participant UI as web(index.html/app.js)
    participant API as Express(/api/items)
    participant SVC as FridgeService
    participant DB as SQLite
    participant DEV as ESP32(virtual/http/off)

    User->>UI: パッケージ文字を入力し登録
    UI->>API: POST /api/items (Cookie: fw_session, honeypot)
    API->>API: ResetGate/リセット窓判定(該当時 503)
    API->>API: SessionManager.ensure(cookie)
    alt ハニーポットに入力あり
        API-->>UI: 現状ビュー(破棄, 成否を秘匿)
    else 正常
        API->>SVC: registerFromOcr(text)
        SVC->>SVC: classifyCategory + resolveExpiry
        SVC->>DB: food_items 追加(session_id 付与)
        SVC->>SVC: estimateRemain(全食材) + evaluateAlert(最小残日数)
        SVC->>DEV: sendToEsp32(command, fan)
        alt 送信失敗
            SVC->>DEV: 最大3回リトライ
            SVC-->>API: deviceConnected=false(表示継続)
        end
        SVC->>DB: alert_logs 追加(fan_activated)
        SVC-->>API: items + alert
        API-->>UI: JSON(残量/推定/補充推奨/LED/ファン)
    end
```

## 4. 状態遷移図(アラートレベル + デバイス)

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

## 5. API 一覧

| メソッド | パス | 概要 |
|---|---|---|
| GET | `/api/state` | 自セッションの一覧+残量+アラート |
| POST | `/api/items` | OCR文字から登録(F1)。空文字は `needManual` |
| POST | `/api/items/manual` | 手動登録(OCR失敗フォールバック) |
| POST | `/api/items/:id/adjust` | 残量手動補正(F2)。他セッションは404 |
| DELETE | `/api/items/:id` | 削除。他セッションは404 |
| POST | `/api/reset` | 手動リセット(自セッションのみ削除)。全セッション全削除は JST03:00 スケジューラのみ |
| GET | `/api/masters` | カテゴリ/対応言語/RTL言語 |
| GET | `/api/device` | 仮想デバイス状態(LED/ファン) |

全 `/api` はセッションIDスコープで動作し、日次リセット中は 503 `resetting` を返す。
