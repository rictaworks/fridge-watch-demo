/** ドメイン型定義。DB 行とドメインオブジェクトの共通形。 */

export interface Category {
  id: number;
  key: string;
  name: string;
}

export interface DatePattern {
  id: number;
  label: string;
  regex: string;
  priority: number;
  kind: 'prefer_ymd' | 'ymd' | 'yymd' | 'md';
}

export interface CategoryKeyword {
  id: number;
  category_id: number;
  keyword: string;
}

export interface AlertLevel {
  id: number;
  key: 'safe' | 'warning' | 'danger';
  name: string;
  min_days: number;
  led_color: string;
}

export interface Esp32Command {
  id: number;
  level_key: string;
  command: string;
  fan_seconds: number;
}

export interface FoodItem {
  id: number;
  session_id: string;
  category_id: number;
  name: string | null;
  expiry_date: string; // 'YYYY-MM-DD'(JST)
  is_estimated: 0 | 1;
  registered_at: string; // ISO8601 UTC
}

export interface RemainAdjustment {
  id: number;
  food_item_id: number;
  session_id: string;
  adjusted_percent: number;
  adjusted_at: string; // ISO8601 UTC
}

export interface AlertLog {
  id: number;
  session_id: string;
  level_id: number;
  fired_at: string;
  fan_activated: 0 | 1;
}
