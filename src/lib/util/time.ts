/**
 * 時刻ユーティリティ。プロジェクト規約により時刻は JST(UTC+9)で統一する。
 * テスト容易性のため「現在時刻」は各ドメイン関数に引数注入する(グローバル参照禁止)。
 */

export const JST_OFFSET_MINUTES = 9 * 60;

/** 与えた瞬間を JST のカレンダー日 [year, month, day] に分解する。 */
export function jstYmd(instant: Date): { year: number; month: number; day: number } {
  const shifted = new Date(instant.getTime() + JST_OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** JST カレンダー日を 'YYYY-MM-DD' に整形する。 */
export function toIsoDate(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/** 与えた瞬間の JST 当日を 'YYYY-MM-DD' で返す。 */
export function jstTodayIso(instant: Date): string {
  const { year, month, day } = jstYmd(instant);
  return toIsoDate(year, month, day);
}

/** 'YYYY-MM-DD' を JST 正午の UTC 瞬間として解釈する(DST 無しの安全な基準点)。 */
function isoToUtcNoon(iso: string): number {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return Date.UTC(y, m - 1, d, 12 - 9, 0, 0); // JST 正午 = UTC 03:00
}

/**
 * from(基準日)から to(対象日)までの JST カレンダー日数差を返す。
 * 例: 同日=0、翌日=1、前日=-1。
 */
export function diffDaysIso(fromIso: string, toIso: string): number {
  const ms = isoToUtcNoon(toIso) - isoToUtcNoon(fromIso);
  return Math.round(ms / 86_400_000);
}

/** ISO 日付に日数を加算した ISO 日付を返す。 */
export function addDaysIso(iso: string, days: number): string {
  const base = isoToUtcNoon(iso) + days * 86_400_000;
  const dt = new Date(base + JST_OFFSET_MINUTES * 60_000);
  return toIsoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** 経過ミリ秒を経過日数(切り捨て、負値は 0)に変換する。残量推定で使用。 */
export function elapsedDays(fromInstant: Date, toInstant: Date): number {
  const ms = toInstant.getTime() - fromInstant.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / 86_400_000);
}
