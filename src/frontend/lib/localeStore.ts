/**
 * ロケールの外部ストア。useSyncExternalStore で購読し、SSR/ハイドレーション不一致を避ける。
 * localStorage を永続層とし、同一タブ内の切替はリスナー通知で反映する。
 * グローバル変数は用いず、状態はクラスインスタンスに閉じ込める。
 */
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, normalizeLocale, type Locale } from './config';

class LocaleStore {
  private current: Locale = DEFAULT_LOCALE;
  private hydrated = false;
  private readonly listeners = new Set<() => void>();

  /** React の購読(effect フェーズで呼ばれる)。初回に localStorage から復元する。 */
  subscribe = (onChange: () => void): (() => void) => {
    this.listeners.add(onChange);
    if (!this.hydrated && typeof window !== 'undefined') {
      this.hydrated = true;
      const saved = normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
      if (saved !== this.current) {
        this.current = saved;
        onChange();
      }
    }
    return () => {
      this.listeners.delete(onChange);
    };
  };

  /** クライアント用スナップショット(純粋)。 */
  getSnapshot = (): Locale => this.current;

  /** SSR 用スナップショット。既定ロケールで安定させる。 */
  getServerSnapshot = (): Locale => DEFAULT_LOCALE;

  /** ロケールを更新し、永続化してリスナーへ通知する。 */
  set = (locale: Locale): void => {
    this.current = locale;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
    this.listeners.forEach((cb) => cb());
  };
}

export const localeStore = new LocaleStore();
