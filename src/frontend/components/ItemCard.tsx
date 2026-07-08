'use client';

/**
 * 食材1件の表示。名前・カテゴリ・賞味期限・残日数・残量%・推定/補充推奨バッジ、
 * 残量の手動補正(0-100%)と削除操作を提供する(設計 F1/F2/UC4)。
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSliders, faTrash } from '@/components/fontawesome';
import { itemLevel, levelClass, RESTOCK_THRESHOLD } from '@/lib/itemLevel';
import type { ItemState } from '@/lib/types';
import { useFridge } from './FridgeProvider';

const REMAIN_MIN = 0;
const REMAIN_MAX = 100;

function clampPercent(value: number): number {
  if (Number.isNaN(value)) return REMAIN_MIN;
  return Math.min(REMAIN_MAX, Math.max(REMAIN_MIN, Math.round(value)));
}

export function ItemCard({ item }: { item: ItemState }) {
  const t = useTranslations();
  const { adjust, remove } = useFridge();
  const [percent, setPercent] = useState<string>(String(item.remainPercent));

  const level = itemLevel(item.remainingDays);
  const low = item.remainPercent <= RESTOCK_THRESHOLD;

  const onApply = () => {
    adjust(item.id, clampPercent(Number(percent)));
  };

  return (
    <li className={`item ${levelClass(level)}`} data-testid="item" data-level={level}>
      <div className="item-main">
        <p className="item-name">
          {item.name || item.categoryName}
          <span className="badges">
            {item.isEstimated && (
              <span className="badge estimated" data-testid="badge-estimated">
                {t('badge.estimated')}
              </span>
            )}
            {item.restock && (
              <span className="badge restock" data-testid="badge-restock">
                {t('badge.restock')}
              </span>
            )}
          </span>
        </p>
        <p className="item-sub">
          {`${item.categoryName} | ${t('list.expiry')}: ${item.expiryDate} | ` +
            `${t('list.remainingDays')}: ${item.remainingDays}${t('unit.days')} | ` +
            `${t('list.remain')}: ${item.remainPercent}${t('unit.percent')}`}
        </p>
        <div className="remain-bar">
          <div
            className={`remain-fill${low ? ' low' : ''}`}
            style={{ width: `${item.remainPercent}%` }}
          />
        </div>
      </div>
      <div className="item-actions">
        <input
          type="number"
          min={REMAIN_MIN}
          max={REMAIN_MAX}
          value={percent}
          aria-label={t('list.adjustLabel')}
          onChange={(e) => setPercent(e.target.value)}
        />
        <button type="button" className="btn" onClick={onApply}>
          <FontAwesomeIcon icon={faSliders} aria-hidden /> {t('list.apply')}
        </button>
        <button type="button" className="btn danger-outline" onClick={() => remove(item.id)}>
          <FontAwesomeIcon icon={faTrash} aria-hidden /> {t('list.delete')}
        </button>
      </div>
    </li>
  );
}
