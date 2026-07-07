/**
 * アプリ設定。文字列リテラル(ロケール一覧・API ベース等)をここに集約し、
 * コンポーネント側へハードコードしない。グローバル変数は使わず、定数 export で共有する。
 */

/** ユーザー向け対応ロケール(設計 i18n.md)。 */
export const LOCALES = ['ja', 'en', 'fr', 'zh', 'ru', 'es', 'ar'] as const;

export type Locale = (typeof LOCALES)[number];

/** RTL(右横書き)ロケール。アラビア語のみ。 */
export const RTL_LOCALES: readonly Locale[] = ['ar'];

/** 既定ロケール。 */
export const DEFAULT_LOCALE: Locale = 'ja';

/** localStorage に選択ロケールを保存するキー。 */
export const LOCALE_STORAGE_KEY = 'fw_locale';

/**
 * API ベース URL。既定は同一オリジン(空文字)。
 * next.config.ts の rewrites により `/api/*` はバックエンド(既定 http://localhost:3000)へ委譲する。
 * 環境変数 NEXT_PUBLIC_API_BASE_URL で明示上書きも可能(絶対 URL 直叩き)。
 */
export const API_BASE_URL: string = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

/** 指定ロケールが RTL かを判定する。 */
export function isRtl(locale: string): boolean {
  return (RTL_LOCALES as readonly string[]).includes(locale);
}

/** 未知の値を安全に既定ロケールへ丸める。 */
export function normalizeLocale(value: string | null | undefined): Locale {
  if (value && (LOCALES as readonly string[]).includes(value)) {
    return value as Locale;
  }
  return DEFAULT_LOCALE;
}
