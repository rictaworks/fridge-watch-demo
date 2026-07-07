import { resolveExpiry } from '../../src/lib/domain/expiryResolver';
import { classifyCategory } from '../../src/lib/domain/categoryClassifier';
import { categoryKeywords, OTHER_CATEGORY_ID, defaultDaysFor } from '../../src/lib/masters';

const NOW = new Date('2026-07-07T04:00:00Z'); // JST 2026-07-07 13:00

function resolve(text: string, categoryId = 8) {
  return resolveExpiry(text, { now: NOW, defaultDays: defaultDaysFor(categoryId) });
}

describe('F1 ExpiryResolver 賞味期限の自動検知', () => {
  it('YYYY.MM.DD を採用する(推定でない)', () => {
    const r = resolve('賞味期限 2026.08.20');
    expect(r.expiryDate).toBe('2026-08-20');
    expect(r.isEstimated).toBe(false);
  });

  it('YYYY年MM月DD日 を採用する', () => {
    const r = resolve('2026年12月01日');
    expect(r.expiryDate).toBe('2026-12-01');
    expect(r.isEstimated).toBe(false);
  });

  it('YYYY-MM-DD を採用する', () => {
    const r = resolve('EXP 2026-09-15');
    expect(r.expiryDate).toBe('2026-09-15');
    expect(r.isEstimated).toBe(false);
  });

  it('「消費期限」近傍の日付を最優先する', () => {
    // 製造 2026.07.01 と 消費期限 2026.07.10 が併記 → 消費期限側を採用
    const r = resolve('製造 2026.07.01 消費期限 2026.07.10');
    expect(r.expiryDate).toBe('2026-07-10');
    expect(r.isEstimated).toBe(false);
  });

  it('年省略 MM.DD は今日以降で最も近い未来日に補完する(今年)', () => {
    const r = resolve('07.20'); // 今日 07-07 → 今年 2026-07-20
    expect(r.expiryDate).toBe('2026-07-20');
    expect(r.isEstimated).toBe(false);
  });

  it('年省略 MM.DD が今年では過去なら翌年に補完する(年跨ぎ)', () => {
    const r = resolve('01.05'); // 2026-01-05 は過去 → 2027-01-05
    expect(r.expiryDate).toBe('2027-01-05');
    expect(r.isEstimated).toBe(false);
  });

  it('YY.MM.DD は 2000 年代として解釈する', () => {
    const r = resolve('27.03.10');
    expect(r.expiryDate).toBe('2027-03-10');
    expect(r.isEstimated).toBe(false);
  });

  it('今日から2年超先の日付は誤読として棄却し、デフォルト補完する', () => {
    const r = resolve('2099.01.01', 1); // 乳製品 default 5 日
    expect(r.isEstimated).toBe(true);
    expect(r.expiryDate).toBe('2026-07-12'); // 07-07 + 5
  });

  it('日付が全く無ければカテゴリ別デフォルト期限で補完し推定にする', () => {
    const r = resolve('よくわからないパッケージ', 7); // 調味料 default 180 日
    expect(r.isEstimated).toBe(true);
    expect(r.expiryDate).toBe('2027-01-03'); // 07-07 + 180
  });

  it('複数の有効日付があれば最も未来の日付を採用する', () => {
    const r = resolve('2026.08.01 2026.10.31 2026.09.09');
    expect(r.expiryDate).toBe('2026-10-31');
    expect(r.isEstimated).toBe(false);
  });

  it('過去日でも採用は許可する(即時アラート対象)', () => {
    const r = resolve('2025-01-01');
    expect(r.expiryDate).toBe('2025-01-01');
    expect(r.isEstimated).toBe(false);
  });

  it('OCR 文字列が空ならデフォルト補完(推定)を返す', () => {
    const r = resolve('', 4); // 野菜 default 7
    expect(r.isEstimated).toBe(true);
    expect(r.expiryDate).toBe('2026-07-14');
  });
});

describe('F1 CategoryClassifier カテゴリ自動判定', () => {
  const classify = (t: string) => classifyCategory(t, categoryKeywords, OTHER_CATEGORY_ID);

  it('キーワードでカテゴリを判定する(牛乳→乳製品)', () => {
    expect(classify('明治おいしい牛乳')).toBe(1);
  });

  it('豚肉→肉', () => {
    expect(classify('国産豚肉ロース')).toBe(2);
  });

  it('鮭→魚介', () => {
    expect(classify('塩鮭切り身')).toBe(3);
  });

  it('未ヒットは「その他」にする', () => {
    expect(classify('謎の食品')).toBe(OTHER_CATEGORY_ID);
  });
});
