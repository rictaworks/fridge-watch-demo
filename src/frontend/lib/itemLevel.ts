/**
 * 残日数からアラートレベルを求める純粋関数(設計 F3)。
 * 安全(残4日以上)/ 注意(残1〜3日)/ 危険(当日以下・期限切れ)。
 * バックエンドと同じ閾値を持つが、一覧の行装飾に用いる表示ロジックとして独立させる。
 */

export type ItemLevel = 'safe' | 'warning' | 'danger';

export const SAFE_MIN_DAYS = 4;
export const WARNING_MIN_DAYS = 1;

/** 残量%がこの値以下なら「補充推奨」。 */
export const RESTOCK_THRESHOLD = 20;

export function itemLevel(remainingDays: number): ItemLevel {
  if (remainingDays >= SAFE_MIN_DAYS) return 'safe';
  if (remainingDays >= WARNING_MIN_DAYS) return 'warning';
  return 'danger';
}

/** レベルに対応する CSS クラス名。 */
export function levelClass(level: ItemLevel): string {
  return `level-${level}`;
}
