import type { ReactElement, ReactNode } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from '@/lib/messages';
import type { Locale } from '@/lib/config';

/** テスト用: 指定ロケールの next-intl コンテキストで包んで描画する。 */
export function renderWithIntl(ui: ReactElement, locale: Locale = 'ja'): RenderResult {
  const messages = getMessages(locale);
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Tokyo">
        {children}
      </NextIntlClientProvider>
    );
  }
  return render(ui, { wrapper: Wrapper });
}
