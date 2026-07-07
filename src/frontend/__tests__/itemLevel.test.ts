import { itemLevel, levelClass, RESTOCK_THRESHOLD } from '@/lib/itemLevel';

describe('itemLevel (設計 F3 の残日数→レベル)', () => {
  it('残4日以上は safe', () => {
    expect(itemLevel(4)).toBe('safe');
    expect(itemLevel(10)).toBe('safe');
  });
  it('残1〜3日は warning', () => {
    expect(itemLevel(1)).toBe('warning');
    expect(itemLevel(3)).toBe('warning');
  });
  it('当日以下・期限切れは danger', () => {
    expect(itemLevel(0)).toBe('danger');
    expect(itemLevel(-2)).toBe('danger');
  });
  it('levelClass はプレフィックス付き', () => {
    expect(levelClass('safe')).toBe('level-safe');
    expect(levelClass('danger')).toBe('level-danger');
  });
  it('補充推奨のしきい値は 20%', () => {
    expect(RESTOCK_THRESHOLD).toBe(20);
  });
});
