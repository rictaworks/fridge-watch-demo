'use client';

/**
 * 手動登録フォーム(設計 F1 手順8: OCR 完全失敗時のフォールバック)。
 * カテゴリと賞味期限を手入力する。ハニーポット項目 website を不可視で設置する。
 */
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKeyboard, faPlus } from '@/components/fontawesome';
import { useFridge } from './FridgeProvider';

export interface ManualFormHandle {
  focus: () => void;
}

export const ManualForm = forwardRef<ManualFormHandle>(function ManualForm(_props, ref) {
  const t = useTranslations();
  const { categories, registerManual } = useFridge();
  const [categoryId, setCategoryId] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const expiryRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      expiryRef.current?.focus();
      expiryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  }));

  const effectiveCategoryId = categoryId || (categories[0] ? String(categories[0].id) : '');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !effectiveCategoryId) return;
    setSubmitting(true);
    try {
      const ok = await registerManual({
        categoryId: Number(effectiveCategoryId),
        expiryDate,
        name: '',
        website,
      });
      if (ok) {
        setExpiryDate('');
        setWebsite('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="panel">
      <h2>
        <FontAwesomeIcon icon={faKeyboard} aria-hidden /> <span>{t('manual.heading')}</span>
      </h2>
      <p className="hint">{t('manual.hint')}</p>
      <form onSubmit={onSubmit} autoComplete="off" aria-label={t('manual.heading')}>
        <label className="field">
          <span>{t('manual.categoryLabel')}</span>
          <select
            value={effectiveCategoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-label={t('manual.categoryLabel')}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('manual.expiryLabel')}</span>
          <input
            ref={expiryRef}
            type="date"
            required
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </label>

        {/* ハニーポット(不可視)。 */}
        <div className="hp" aria-hidden>
          <label>
            Website
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>

        <button type="submit" className="btn" disabled={submitting}>
          <FontAwesomeIcon icon={faPlus} aria-hidden /> <span>{t('manual.submit')}</span>
        </button>
      </form>
    </section>
  );
});
