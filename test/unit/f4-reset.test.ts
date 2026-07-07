import { openDb } from '../../src/lib/db';
import { resetTransactions, isResetWindow } from '../../src/lib/domain/dailyReset';

function seedTx(db: ReturnType<typeof openDb>) {
  db.prepare(
    "INSERT INTO sessions (session_id, created_at, last_accessed_at) VALUES ('s1','2026-07-07T00:00:00Z','2026-07-07T00:00:00Z')",
  ).run();
  db.prepare(
    "INSERT INTO food_items (session_id, category_id, name, expiry_date, is_estimated, registered_at) VALUES ('s1',1,'牛乳','2026-07-10',0,'2026-07-07T00:00:00Z')",
  ).run();
  const itemId = (db.prepare('SELECT last_insert_rowid() id').get() as { id: number }).id;
  db.prepare(
    "INSERT INTO remain_adjustments (food_item_id, session_id, adjusted_percent, adjusted_at) VALUES (?, 's1', 50, '2026-07-07T01:00:00Z')",
  ).run(itemId);
  db.prepare(
    "INSERT INTO alert_logs (session_id, level_id, fired_at, fan_activated) VALUES ('s1', 3, '2026-07-07T01:00:00Z', 1)",
  ).run();
}

describe('F4 DailyReset 日次リセット(JST 03:00)', () => {
  it('トランザクションデータを全削除する', () => {
    const db = openDb({ filename: ':memory:' });
    seedTx(db);
    const result = resetTransactions(db);
    const count = (t: string) =>
      (db.prepare(`SELECT COUNT(*) c FROM ${t}`).get() as { c: number }).c;
    expect(count('food_items')).toBe(0);
    expect(count('remain_adjustments')).toBe(0);
    expect(count('alert_logs')).toBe(0);
    expect(count('sessions')).toBe(0);
    expect(result.deleted.food_items).toBe(1);
    expect(result.deleted.sessions).toBe(1);
    db.close();
  });

  it('マスタ 61 件は保持する', () => {
    const db = openDb({ filename: ':memory:' });
    seedTx(db);
    resetTransactions(db);
    const count = (t: string) =>
      (db.prepare(`SELECT COUNT(*) c FROM ${t}`).get() as { c: number }).c;
    const masters =
      count('categories') +
      count('default_expiry_master') +
      count('consumption_rate_master') +
      count('date_pattern_master') +
      count('category_keywords') +
      count('alert_level_master') +
      count('esp32_command_master');
    expect(masters).toBe(61);
    db.close();
  });

  it('JST 03:00 はリセット時刻ウィンドウと判定する', () => {
    // JST 03:00 = UTC 前日 18:00
    const at0300 = new Date('2026-07-06T18:00:00Z');
    expect(isResetWindow(at0300)).toBe(true);
  });

  it('JST 03:00 以外はリセット時刻ではない', () => {
    const at1200 = new Date('2026-07-07T03:00:00Z'); // JST 12:00
    expect(isResetWindow(at1200)).toBe(false);
  });
});
