import { estimateRemain, clampPercent } from '../../src/lib/domain/remainEstimator';

const REG = new Date('2026-07-01T00:00:00Z');

function daysLater(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000);
}

describe('F2 RemainEstimator 残量推定(ルールベース)', () => {
  it('登録直後(経過0日)は基準残量 100% を返す', () => {
    const r = estimateRemain({ basePercent: 100, baseAt: REG, ratePerDay: 20, now: REG });
    expect(r.percent).toBe(100);
    expect(r.restock).toBe(false);
  });

  it('乳製品 20%/日 で2日経過 → 60%', () => {
    const r = estimateRemain({
      basePercent: 100,
      baseAt: REG,
      ratePerDay: 20,
      now: daysLater(REG, 2),
    });
    expect(r.percent).toBe(60);
  });

  it('調味料 1%/日 で10日経過 → 90%', () => {
    const r = estimateRemain({
      basePercent: 100,
      baseAt: REG,
      ratePerDay: 1,
      now: daysLater(REG, 10),
    });
    expect(r.percent).toBe(90);
  });

  it('下限 0% にクランプする', () => {
    const r = estimateRemain({
      basePercent: 100,
      baseAt: REG,
      ratePerDay: 30,
      now: daysLater(REG, 10),
    });
    expect(r.percent).toBe(0);
  });

  it('補正値を基準残量として使う', () => {
    const adjustAt = daysLater(REG, 1);
    const r = estimateRemain({
      basePercent: 50,
      baseAt: adjustAt,
      ratePerDay: 20,
      now: daysLater(adjustAt, 1),
    });
    expect(r.percent).toBe(30); // 50 - 20*1
  });

  it('端末時刻異常(now が基準より過去)は基準残量をそのまま返す', () => {
    const r = estimateRemain({
      basePercent: 70,
      baseAt: daysLater(REG, 5),
      ratePerDay: 20,
      now: REG, // 基準より過去
    });
    expect(r.percent).toBe(70);
  });

  it('経過日数は切り捨てる(1.5日 → 1日分)', () => {
    const r = estimateRemain({
      basePercent: 100,
      baseAt: REG,
      ratePerDay: 20,
      now: new Date(REG.getTime() + 1.5 * 86_400_000),
    });
    expect(r.percent).toBe(80);
  });

  it('残量 20% 以下で補充推奨フラグを立てる', () => {
    const r = estimateRemain({
      basePercent: 100,
      baseAt: REG,
      ratePerDay: 20,
      now: daysLater(REG, 4),
    });
    expect(r.percent).toBe(20);
    expect(r.restock).toBe(true);
  });

  it('残量 21% では補充推奨フラグを立てない', () => {
    const r = estimateRemain({
      basePercent: 100,
      baseAt: REG,
      ratePerDay: 1,
      now: daysLater(REG, 79),
    });
    expect(r.percent).toBe(21);
    expect(r.restock).toBe(false);
  });
});

describe('F2 clampPercent 補正入力のクランプ', () => {
  it('100 超は 100 にする', () => {
    expect(clampPercent(150)).toBe(100);
  });
  it('負値は 0 にする', () => {
    expect(clampPercent(-10)).toBe(0);
  });
  it('範囲内はそのまま', () => {
    expect(clampPercent(42)).toBe(42);
  });
  it('小数は丸める', () => {
    expect(clampPercent(42.6)).toBe(43);
  });
});
