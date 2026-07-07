'use client';

/**
 * ロケール状態を保持し、next-intl の Provider で配下へ配布する。
 * URL ルーティングは用いず、選択は localStorage に保存する(既存デモの挙動を踏襲)。
 * <html> の lang / dir はここで同期し、ar は RTL にする。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { LOCALES, isRtl, type Locale } from '@/lib/config';
import { localeStore } from '@/lib/localeStore';
import { getMessages } from '@/lib/messages';

interface LocaleContextValue {
  locale: Locale;
  locales: readonly Locale[];
  dir: 'ltr' | 'rtl';
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocaleController(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocaleController must be used within LocaleProvider');
  }
  return ctx;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // ロケールは外部ストア(localStorage 永続)から購読する。SSR は既定ロケールで安定させる。
  const locale = useSyncExternalStore(
    localeStore.subscribe,
    localeStore.getSnapshot,
    localeStore.getServerSnapshot,
  );

  const dir: 'ltr' | 'rtl' = isRtl(locale) ? 'rtl' : 'ltr';

  // 外部システム(DOM)への同期: <html> の lang / dir を現在ロケールに合わせる。
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const setLocale = useCallback((next: Locale) => {
    localeStore.set(next);
  }, []);

  const messages = useMemo(() => getMessages(locale), [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, locales: LOCALES, dir, setLocale }),
    [locale, dir, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Tokyo">
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
