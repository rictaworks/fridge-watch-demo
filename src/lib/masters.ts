/**
 * マスタ(config/masters.json)への型付きアクセサ。
 * ドメイン層はここ経由でマスタを受け取り、DB とテストの双方で同一データを使う。
 */
import raw from '../config/masters.json';
import appConfig from '../config/app.json';
import type {
  Category,
  DatePattern,
  CategoryKeyword,
  AlertLevel,
  Esp32Command,
} from './db/types';

export const categories = raw.categories as Category[];
export const defaultExpiry = raw.default_expiry as { category_id: number; default_days: number }[];
export const consumptionRate = raw.consumption_rate as {
  category_id: number;
  percent_per_day: number;
}[];
export const datePatterns = raw.date_patterns as DatePattern[];
export const categoryKeywords = raw.category_keywords as CategoryKeyword[];
export const alertLevels = raw.alert_levels as AlertLevel[];
export const esp32Commands = raw.esp32_commands as Esp32Command[];

export const config = appConfig;

export const OTHER_CATEGORY_ID =
  categories.find((c) => c.key === 'other')?.id ?? categories[categories.length - 1].id;

export function defaultDaysFor(categoryId: number): number {
  const row = defaultExpiry.find((d) => d.category_id === categoryId);
  if (!row) {
    throw new Error(`default_expiry_master にカテゴリ ${categoryId} が存在しません`);
  }
  return row.default_days;
}

export function consumptionRateFor(categoryId: number): number {
  const row = consumptionRate.find((r) => r.category_id === categoryId);
  if (!row) {
    throw new Error(`consumption_rate_master にカテゴリ ${categoryId} が存在しません`);
  }
  return row.percent_per_day;
}
