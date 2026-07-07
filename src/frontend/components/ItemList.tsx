'use client';

/** 冷蔵庫の中身一覧。日次リセット操作を含む(設計 F4 手動リセットは自セッションのみ)。 */
import { useTranslations } from 'next-intl';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBoxOpen, faRotate } from '@/components/fontawesome';
import { useFridge } from './FridgeProvider';
import { useUi } from './UiProvider';
import { ItemCard } from './ItemCard';

export function ItemList() {
  const t = useTranslations();
  const { view, reset } = useFridge();
  const { confirm } = useUi();
  const items = view?.items ?? [];

  const onReset = async () => {
    const ok = await confirm(t('action.confirmResetTitle'), t('action.confirmResetBody'));
    if (ok) await reset();
  };

  return (
    <section className="panel list-panel">
      <div className="list-head">
        <h2>
          <FontAwesomeIcon icon={faBoxOpen} aria-hidden /> <span>{t('list.heading')}</span>
        </h2>
        <button type="button" className="btn danger-outline" onClick={onReset}>
          <FontAwesomeIcon icon={faRotate} aria-hidden /> <span>{t('action.reset')}</span>
        </button>
      </div>
      <ul className="item-list">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </ul>
      {items.length === 0 && <p className="empty">{t('list.empty')}</p>}
    </section>
  );
}
