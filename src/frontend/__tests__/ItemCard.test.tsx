import { screen } from '@testing-library/react';
import { renderWithIntl } from './renderWithIntl';
import type { ItemState } from '@/lib/types';

const adjust = jest.fn();
const remove = jest.fn();

// useFridge を差し替え、ItemCard の表示ロジックのみを検証する。
jest.mock('@/components/FridgeProvider', () => ({
  useFridge: () => ({ adjust, remove }),
}));

import { ItemCard } from '@/components/ItemCard';

function makeItem(overrides: Partial<ItemState> = {}): ItemState {
  return {
    id: 1,
    name: '牛乳',
    categoryId: 1,
    categoryName: '乳製品',
    expiryDate: '2026-08-20',
    isEstimated: false,
    remainingDays: 5,
    remainPercent: 80,
    restock: false,
    ...overrides,
  };
}

describe('ItemCard', () => {
  it('名前・カテゴリ・賞味期限・残日数・残量% を表示する', () => {
    renderWithIntl(<ItemCard item={makeItem()} />);
    expect(screen.getByText('牛乳')).toBeInTheDocument();
    const sub = screen.getByText(/乳製品/);
    expect(sub).toHaveTextContent('2026-08-20');
    expect(sub).toHaveTextContent('5');
    expect(sub).toHaveTextContent('80');
  });

  it('is_estimated が true のとき「推定」バッジを表示する', () => {
    renderWithIntl(<ItemCard item={makeItem({ isEstimated: true })} />);
    expect(screen.getByTestId('badge-estimated')).toHaveTextContent('推定');
  });

  it('is_estimated が false のとき「推定」バッジを表示しない', () => {
    renderWithIntl(<ItemCard item={makeItem({ isEstimated: false })} />);
    expect(screen.queryByTestId('badge-estimated')).toBeNull();
  });

  it('restock が true のとき「補充推奨」バッジを表示する', () => {
    renderWithIntl(<ItemCard item={makeItem({ restock: true, remainPercent: 15 })} />);
    expect(screen.getByTestId('badge-restock')).toHaveTextContent('補充推奨');
  });

  it('残日数に応じてレベル装飾クラスが付く(danger)', () => {
    renderWithIntl(<ItemCard item={makeItem({ remainingDays: 0 })} />);
    expect(screen.getByTestId('item')).toHaveAttribute('data-level', 'danger');
  });

  it('名前が空ならカテゴリ名を表示する', () => {
    renderWithIntl(<ItemCard item={makeItem({ name: null })} />);
    expect(screen.getByText('乳製品', { selector: '.item-name' })).toBeInTheDocument();
  });
});
