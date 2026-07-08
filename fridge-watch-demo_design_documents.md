# fridge-watch-demo 設計資料

**製品名:** スマート冷蔵庫管理(食材残量・賞味期限 自動検知)
**対象エディション:** デモ版(アイデアの視覚化)
**リポジトリ名:** `fridge-watch-demo`
**作成日:** 2026-07-07

---

## 1. 仕様書

### 1.1 目的

冷蔵庫内の食材について「賞味期限」と「残量」を自動検知し、期限接近をLED・ファン(ESP32)と画面で知らせる体験を展示物として提供する。技術・UXの体験が目的であり、本番運用は対象外。

### 1.2 課題分類とプラットフォーム選定

- 課題分類: **IoT該当** → ESP32 + LED + ファン を実装
- ソフトウェアプラットフォーム: **ウェブ**(展示会場で来場者の複数端末から手軽に体験可能なため)
- ESP32通信方式: **Wi-Fi**(テザリング可)。ネットワーク越しの外部API呼び出しには該当せず、デモ版でも使用可

### 1.3 技術スタック

| レイヤ | 技術 |
|---|---|
| フロントエンド | Next.js |
| バックエンド | Ruby on Rails(API) |
| 画像解析 | FastAPI + pytesseract + OpenCV(ローカルライブラリのみ、外部API不使用) |
| DB | SQLite(デモ版はデプロイ先を問わずSQLite) |
| ハードウェア | ESP32 + LED(緑/黄/赤) + ファン、Wi-Fi(HTTP)通信 |
| デプロイ | フロント: Vercel(無料) / バックエンド: Railway(無料、不可時のみRender) |

### 1.4 実装方式(デモ版制約)

- 1issueのワンショット実装(`claude --dangerously-skip-permissions` でセキュリティレビューをスキップ)
- 外部API・APIキーが必要なサービスは一切使用しない
- ユーザー認証・認可なし。セッション管理(Cookie + SQLite)のみ
- **セッションIDを全テーブルのオーナーキーとして付与し、セッションをまたいだデータの参照・操作を禁止**(認証なしでも他ユーザーのデータは見えない)
- DBは毎日 JST 03:00 に自動リセット(トランザクションデータのみ削除、マスタは保持)
- Bot対策はハニーポット方式(登録フォームに不可視フィールドを設置し、入力があれば破棄)
- AI機能は不使用。OCR(pytesseract)+ルールベースで代替

### 1.5 個人情報の取り扱い

デモ版方針に準拠し、特定の個人を識別できる情報は一切保持しない。

- 氏名・ニックネーム・メールアドレス・住所・電話番号・生年月日: **使用しない**
- セッションIDは端末識別子として扱い、個人情報には該当しないと整理する
- 保持するのは食材情報とセッションIDのみ

### 1.6 機能仕様

#### F1: 食材登録(賞味期限・カテゴリ自動検知)

1. 利用者がパッケージ写真をアップロードする(5MB超はサーバ側で縮小)
2. FastAPIがpytesseractで文字抽出し、日付パターンマスタの正規表現で日付候補を抽出する
3. 「消費期限」近傍の日付を最優先、なければ**最も未来の日付**を賞味期限として採用する
4. 年省略表記(`07.20`)は「今日以降で最も近い未来日」として年を補完する(年跨ぎ対応)
5. 日省略表記(`2028.04` / `2028年4月`)は**当該月の末日**を賞味期限とし、UIに「推定」バッジを表示する
6. 今日から**2年超先の日付は誤読として棄却**する
7. 抽出文字列をカテゴリキーワード辞書と照合してカテゴリを決定する(未ヒット時は「その他」)
8. **OCR完全失敗時、または日付候補が一つも採用できない場合は手動入力フォームへ誘導する**(needManual)。カテゴリ別デフォルト期限による自動補完は行わない(誤った日付を無言で登録しないため)
9. 期限が過去日でも登録は許可し、即時アラート対象とする
10. セッションID不在時は処理冒頭で新規発行する。レコードにはセッションIDを必ず付与する

#### F2: 残量推定(ルールベース)

1. 残量% = 基準残量 −(基準時刻からの経過日数 × カテゴリ別日次消費率)
2. 基準は最新の手動補正(値・時刻)、補正がなければ登録時(100%)
3. 結果は0〜100%にクランプ。補正入力も0〜100%にクランプ
4. 端末時刻異常(基準時刻より過去)の場合は基準残量をそのまま表示する
5. 残量20%以下で「補充推奨」フラグを立てる

#### F3: アラート判定・ESP32制御

1. セッション内全食材の残日数を計算し、最小残日数でレベルを決定する
   - 安全(残4日以上)= 緑LED / 注意(残1〜3日)= 黄LED / 危険(当日以下・期限切れ)= 赤LED
2. 危険レベル発生時、ファンを30秒作動(換気デモ)。クールダウン10分で重複起動を防止する
3. ESP32へWi-Fi(HTTP)でコマンド送信。失敗時は3回リトライ後スキップし、UIに「デバイス未接続」を表示して画面表示は継続する
4. 食材0件時は消灯コマンドを送る

#### F4: 日次リセット

1. JST 03:00にトランザクションデータ(食材・補正履歴・アラート履歴・セッション)を全削除する
2. マスタデータは保持する
3. リセット実行中のアクセスには「リセット中」応答を返す

### 1.7 マスタデータ件数(デモ版)

| マスタ | 件数 | 内容 |
|---|---|---|
| カテゴリマスタ | **8件** | 乳製品/肉/魚介/野菜/果物/卵/調味料/その他 |
| デフォルト賞味期限マスタ | **8件** | カテゴリごとの補完日数(例: 乳製品5日、野菜7日、調味料180日)。※F1のOCRフォールバックには使用しない(§1.6 F1-8) |
| 日次消費率マスタ | **8件** | カテゴリごとの残量減少率(例: 乳製品20%/日、調味料1%/日) |
| 日付抽出パターンマスタ | **9件** | YYYY.MM.DD / YYYY年MM月DD日 / YY.MM.DD / MM.DD / YYYY-MM-DD / 消費期限接頭パターン / YYYY.MM(日省略) / YYYY年MM月(日省略) / 消費期限接頭(日省略) |
| カテゴリキーワード辞書 | **24件** | 各カテゴリ3語(例: 牛乳・ミルク・ヨーグルト→乳製品) |
| アラートレベルマスタ | **3件** | 安全/注意/危険(閾値・LED色) |
| ESP32制御コマンドマスタ | **4件** | 緑点灯/黄点灯/赤点灯+ファン/消灯 |
| **合計** | **64件** | |

> **注記: デモ版は最小単位のデータでしかテストできない。** 上記マスタは動作体験に必要な最小構成であり、テスト(全48ケース)も食材1〜3件・単一セッション規模の最小単位データで実施している。大量データ・多数同時セッション・長期運用での検証はMVP以降の対象とする。

### 1.8 テスト結果サマリ

| 関数 | ケース数 | 最終結果 |
|---|---|---|
| F1 食材登録 | 16 | 全通過(v3) |
| F2 残量推定 | 12 | 全通過(v2) |
| F3 アラート・ESP32制御 | 14 | 全通過(v3) |
| F4 日次リセット | 6 | 全通過(v1) |
| **合計 / 課題解決度** | **48** | **100%** |

---

## 2. ER図

```mermaid
erDiagram
    SESSIONS ||--o{ FOOD_ITEMS : "所有"
    SESSIONS ||--o{ ALERT_LOGS : "所有"
    FOOD_ITEMS ||--o{ REMAIN_ADJUSTMENTS : "補正履歴"
    CATEGORIES ||--o{ FOOD_ITEMS : "分類"
    CATEGORIES ||--|| DEFAULT_EXPIRY_MASTER : "既定期限"
    CATEGORIES ||--|| CONSUMPTION_RATE_MASTER : "消費率"
    CATEGORIES ||--o{ CATEGORY_KEYWORDS : "辞書"
    ALERT_LEVEL_MASTER ||--o{ ALERT_LOGS : "レベル"
    ALERT_LEVEL_MASTER ||--|| ESP32_COMMAND_MASTER : "制御対応"

    SESSIONS {
        string session_id PK "端末識別子(個人情報非該当)"
        datetime created_at
        datetime last_accessed_at
    }
    FOOD_ITEMS {
        int id PK
        string session_id FK "オーナーキー(必須)"
        int category_id FK
        string name "OCR抽出名(任意)"
        date expiry_date
        bool is_estimated "期限が推定補完か"
        datetime registered_at
    }
    REMAIN_ADJUSTMENTS {
        int id PK
        int food_item_id FK
        string session_id FK "オーナーキー(必須)"
        int adjusted_percent "0-100"
        datetime adjusted_at
    }
    ALERT_LOGS {
        int id PK
        string session_id FK "オーナーキー(必須)"
        int level_id FK
        datetime fired_at
        bool fan_activated
    }
    CATEGORIES {
        int id PK
        string name "8件"
    }
    DEFAULT_EXPIRY_MASTER {
        int category_id PK
        int default_days
    }
    CONSUMPTION_RATE_MASTER {
        int category_id PK
        int percent_per_day
    }
    CATEGORY_KEYWORDS {
        int id PK
        int category_id FK
        string keyword "24件"
    }
    DATE_PATTERN_MASTER {
        int id PK
        string regex "6件"
        int priority
    }
    ALERT_LEVEL_MASTER {
        int id PK
        string name "3件"
        int min_days
        string led_color
    }
    ESP32_COMMAND_MASTER {
        int id PK
        string command "4件"
        int fan_seconds
    }
```

---

## 3. DFD(データフロー図)

```mermaid
flowchart LR
    U([利用者]) -->|パッケージ写真| P1
    U -->|残量補正| P2
    subgraph システム境界
        P1[P1 食材登録<br>OCR+ルールベース判定]
        P2[P2 残量推定]
        P3[P3 アラート判定]
        P4[P4 日次リセット]
        D1[(D1 食材データ<br>session_id付与)]
        D2[(D2 補正履歴)]
        D3[(D3 マスタ群 61件)]
        D4[(D4 アラート履歴)]
    end
    P1 -->|食材レコード| D1
    D3 -->|日付パターン/辞書/既定期限| P1
    D1 --> P2
    D2 --> P2
    D3 -->|消費率| P2
    U2([利用者]) <--|一覧・残量表示| P2
    D1 --> P3
    D3 -->|閾値/コマンド| P3
    P3 --> D4
    P3 -->|Wi-Fi HTTP| E[ESP32<br>LED+ファン]
    T([スケジューラ JST03:00]) --> P4
    P4 -->|全削除| D1
    P4 -->|全削除| D2
    P4 -->|全削除| D4
```

---

## 4. シーケンス図(食材登録〜ESP32制御)

```mermaid
sequenceDiagram
    actor User as 利用者
    participant FE as Next.js
    participant BE as Rails API
    participant OCR as FastAPI(pytesseract)
    participant DB as SQLite
    participant ESP as ESP32(LED/ファン)

    User->>FE: パッケージ写真アップロード
    FE->>BE: POST /items(Cookie: session_id)
    alt session_id なし
        BE->>BE: 新規session_id発行
    end
    Note over BE: ハニーポット項目に入力あれば破棄
    BE->>OCR: 画像送信(5MB超は縮小)
    OCR->>OCR: 文字抽出→日付候補抽出→年補完→2年超棄却
    OCR-->>BE: 期限候補+抽出テキスト
    alt OCR完全失敗 または 日付候補が一つも採用不可
        BE-->>FE: needManual(手動入力フォームへ誘導)。デフォルト補完はしない
        FE-->>User: 手動入力フォーム表示
    else 日付採用可(日省略時は当該月末日、is_estimated=true)
        BE->>DB: キーワード辞書照合→カテゴリ決定(未ヒットは「その他」)
        BE->>DB: 食材レコード保存(session_id付与)
        BE->>BE: F3 アラート判定(最小残日数→レベル)
        BE->>ESP: HTTP コマンド送信(LED色/ファン)
        alt 送信失敗
            BE->>ESP: 最大3回リトライ
            BE-->>FE: 「デバイス未接続」表示(処理は継続)
        end
        ESP-->>BE: ACK
        BE-->>FE: 登録結果+残量+アラートレベル
        FE-->>User: 一覧表示(推定バッジ/補充推奨)
    end
```

---

## 5. クラス図

```mermaid
classDiagram
    class SessionManager {
        +ensure_session(cookie) session_id
        +scope(session_id) QueryScope
    }
    class FoodItemRegistrar {
        -OcrClient ocr
        -ExpiryResolver resolver
        -CategoryClassifier classifier
        +register(image, session_id) FoodItem
        +register_manual(params, session_id) FoodItem
    }
    class OcrClient {
        +extract_text(image) string
        -shrink_if_over_5mb(image) image
    }
    class ExpiryResolver {
        -DatePatternMaster patterns
        -DefaultExpiryMaster defaults
        +resolve(text, category) date
        -complete_year(md_date) date
        -reject_over_2years(date) bool
        -prefer_shomikigen(candidates) date
    }
    class CategoryClassifier {
        -CategoryKeywords dictionary
        +classify(text) Category
    }
    class RemainEstimator {
        -ConsumptionRateMaster rates
        +estimate(item, now) percent
        +adjust(item, percent, now) void
        -clamp_0_100(value) percent
    }
    class AlertEvaluator {
        -AlertLevelMaster levels
        +evaluate(session_id) AlertLevel
        -min_remaining_days(items) int
    }
    class Esp32Controller {
        -Esp32CommandMaster commands
        -cooldown_10min
        +send(level) bool
        -retry_3times() bool
        +turn_off() void
    }
    class DailyResetJob {
        +run_at_jst_0300() void
        -truncate_transactions() void
    }
    class FoodItem {
        +id
        +session_id
        +category
        +expiry_date
        +is_estimated
    }
    class RemainAdjustment {
        +food_item_id
        +adjusted_percent
        +adjusted_at
    }

    FoodItemRegistrar --> OcrClient
    FoodItemRegistrar --> ExpiryResolver
    FoodItemRegistrar --> CategoryClassifier
    FoodItemRegistrar --> SessionManager
    FoodItemRegistrar ..> FoodItem : 生成
    RemainEstimator ..> FoodItem
    RemainEstimator ..> RemainAdjustment
    AlertEvaluator ..> FoodItem
    AlertEvaluator --> Esp32Controller
    DailyResetJob ..> FoodItem : 削除
    DailyResetJob ..> RemainAdjustment : 削除
```

---

## 6. 状態遷移図(食材ライフサイクル+デバイス)

```mermaid
stateDiagram-v2
    [*] --> 登録処理中 : 写真アップロード
    登録処理中 --> 手動入力待ち : OCR完全失敗
    手動入力待ち --> 安全 : 手動登録完了
    登録処理中 --> 安全 : 残4日以上
    登録処理中 --> 注意 : 残1〜3日
    登録処理中 --> 危険 : 当日以下/期限切れ(過去日登録含む)

    安全 --> 注意 : 日数経過(残3日)
    注意 --> 危険 : 日数経過(残0日)
    安全 --> 補充推奨 : 残量20%以下
    注意 --> 補充推奨 : 残量20%以下
    補充推奨 --> 安全 : 手動補正で残量回復

    安全 --> [*] : 削除/JST03:00リセット
    注意 --> [*] : 削除/JST03:00リセット
    危険 --> [*] : 削除/JST03:00リセット
    補充推奨 --> [*] : 削除/JST03:00リセット

    state ESP32デバイス {
        [*] --> 消灯 : 食材0件
        消灯 --> 緑LED : 安全
        緑LED --> 黄LED : 注意
        黄LED --> 赤LED_ファン30秒 : 危険
        赤LED_ファン30秒 --> 赤LED_クールダウン : 30秒経過
        赤LED_クールダウン --> 赤LED_ファン30秒 : 10分経過+危険継続
        赤LED_ファン30秒 --> 緑LED : 危険食材の削除
        黄LED --> 消灯 : 全削除/リセット
        緑LED --> 消灯 : 全削除/リセット
    }
```

---

## 7. ユースケース図

```mermaid
flowchart LR
    visitor(["👤 来場者(利用者)"])
    scheduler(["⏰ スケジューラ"])
    esp(["🔌 ESP32"])

    subgraph fridge-watch-demo
        UC1((食材を写真で登録する))
        UC2((賞味期限の自動検知結果を確認する))
        UC3((残量の自動推定を確認する))
        UC4((残量を手動補正する))
        UC5((期限アラートを受け取る))
        UC6((食材を削除する))
        UC7((手動で食材を登録する))
        UC8((日次リセットを実行する))
        UC9((LED/ファンで通知する))
    end

    visitor --> UC1
    visitor --> UC2
    visitor --> UC3
    visitor --> UC4
    visitor --> UC6
    visitor --> UC5
    UC1 -. include .-> UC2
    UC1 -. OCR失敗時 extend .-> UC7
    UC5 -. include .-> UC9
    UC9 --- esp
    scheduler --> UC8
```

**ユースケース補足**

| UC | 事前条件 | 事後条件 |
|---|---|---|
| UC1 食材を写真で登録 | セッションID(なければ自動発行) | 食材レコード保存(session_id付与)、アラート再判定 |
| UC4 残量を手動補正 | 自セッションの食材が存在 | 補正履歴保存、以後の推定は補正値起点 |
| UC5/UC9 アラート通知 | 食材1件以上 | LED色更新、危険時ファン30秒(クールダウン10分) |
| UC8 日次リセット | JST 03:00 | トランザクションデータ全削除、マスタ61件は保持 |

---

## 8. 制約・免責(デモ版)

- 本設計はデモ版のみを対象とし、MVP・製品版フルエディションの設計・比較は含まない
- **デモ版は最小単位のデータでしかテストできない**(マスタ61件・食材1〜3件・単一セッション規模)。負荷・同時多数・長期運用の検証は対象外
- 測定(アクセス解析)・保守・監視は行わない
- 外部API・APIキー・reCAPTCHAは不使用(Bot対策はハニーポット)
- 認証なし。セッションIDによるデータ分離のみで、セッションをまたぐ参照・操作は不可
- データは毎日 JST 03:00 に消去される
