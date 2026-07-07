'use client';

/**
 * 食材登録フォーム(設計 F1)。パッケージ写真アップロードを主経路とし、
 * デモではパッケージ文字の貼り付けにも対応する。ハニーポット項目 website を不可視で設置する。
 */
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera, faImage, faPlus } from '@/components/fontawesome';
import { useFridge } from './FridgeProvider';

interface Props {
  /** OCR 失敗(need-manual)時に手動フォームへ誘導するコールバック。 */
  onNeedManual?: () => void;
}

export function RegisterForm({ onNeedManual }: Props) {
  const t = useTranslations();
  const { register } = useFridge();
  const [ocrText, setOcrText] = useState('');
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [fileName, setFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setOcrText('');
    setName('');
    setWebsite('');
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const photo = fileRef.current?.files?.[0] ?? null;
      const result = await register({ photo, ocrText, name, website });
      if (result === 'ok') {
        reset();
      } else if (result === 'need-manual') {
        onNeedManual?.();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="panel">
      <h2>
        <FontAwesomeIcon icon={faCamera} aria-hidden /> <span>{t('register.heading')}</span>
      </h2>
      <form onSubmit={onSubmit} autoComplete="off" aria-label={t('register.heading')}>
        <label className="field">
          <span>{t('register.photoLabel')}</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
          />
        </label>
        {fileName && (
          <p className="file-name">
            <FontAwesomeIcon icon={faImage} aria-hidden /> {fileName}
          </p>
        )}
        <label className="field">
          <span>{t('register.ocrLabel')}</span>
          <textarea rows={2} value={ocrText} onChange={(e) => setOcrText(e.target.value)} />
        </label>
        <p className="hint">{t('register.ocrHint')}</p>
        <label className="field">
          <span>{t('register.nameLabel')}</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        {/* ハニーポット: 人間には不可視。入力があればサーバ側で破棄される(設計 1.4)。 */}
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

        <button type="submit" className="btn primary" disabled={submitting}>
          <FontAwesomeIcon icon={faPlus} aria-hidden /> <span>{t('register.submit')}</span>
        </button>
      </form>
    </section>
  );
}
