/**
 * SQLite スキーマ定義(デモ版方針: SQLite 固定・認証なし・セッション所有分離)。
 * マスタ = 恒久データ、トランザクション = 日次リセット対象。
 */

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

-- ===== マスタ(日次リセットで保持) =====
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS default_expiry_master (
  category_id INTEGER PRIMARY KEY REFERENCES categories(id),
  default_days INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS consumption_rate_master (
  category_id INTEGER PRIMARY KEY REFERENCES categories(id),
  percent_per_day INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS date_pattern_master (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  regex TEXT NOT NULL,
  priority INTEGER NOT NULL,
  kind TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS category_keywords (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  keyword TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_level_master (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  min_days INTEGER NOT NULL,
  led_color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS esp32_command_master (
  id INTEGER PRIMARY KEY,
  level_key TEXT NOT NULL,
  command TEXT NOT NULL,
  fan_seconds INTEGER NOT NULL
);

-- ===== トランザクション(日次リセットで全削除) =====
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS food_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT,
  expiry_date TEXT NOT NULL,
  is_estimated INTEGER NOT NULL DEFAULT 0,
  registered_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_food_items_session ON food_items(session_id);

CREATE TABLE IF NOT EXISTS remain_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  food_item_id INTEGER NOT NULL REFERENCES food_items(id),
  session_id TEXT NOT NULL,
  adjusted_percent INTEGER NOT NULL,
  adjusted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_adjustments_item ON remain_adjustments(food_item_id);

CREATE TABLE IF NOT EXISTS alert_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  level_id INTEGER NOT NULL REFERENCES alert_level_master(id),
  fired_at TEXT NOT NULL,
  fan_activated INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_alert_logs_session ON alert_logs(session_id);
`;

/** 日次リセットで全削除する(マスタは保持する)トランザクションテーブル。 */
export const TRANSACTION_TABLES = [
  'remain_adjustments',
  'alert_logs',
  'food_items',
  'sessions',
] as const;
