'use client';

/** アプリヘッダー。ブランドと言語切替を表示する。 */
import { useTranslations } from 'next-intl';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSnowflake, faLanguage } from '@/components/fontawesome';
import { useLocaleController } from './LocaleProvider';
import type { Locale } from '@/lib/config';

export function Header() {
  const t = useTranslations();
  const { locale, locales, setLocale } = useLocaleController();

  return (
    <header className="app-header">
      <div className="brand">
        <FontAwesomeIcon icon={faSnowflake} className="brand-icon" aria-hidden />
        <div>
          <h1>{t('app.title')}</h1>
          <p className="subtitle">{t('app.subtitle')}</p>
        </div>
      </div>
      <label className="lang-select">
        <FontAwesomeIcon icon={faLanguage} aria-hidden />
        <span className="sr-only">{t('lang.label')}</span>
        <select
          aria-label={t('lang.label')}
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
        >
          {locales.map((loc) => (
            <option key={loc} value={loc}>
              {loc.toUpperCase()}
            </option>
          ))}
        </select>
      </label>
    </header>
  );
}
