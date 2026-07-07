import { openDb } from '../../src/lib/db';

describe('マスタシード(デモ版 61 件)', () => {
  it('マスタ合計が 61 件になる', () => {
    const db = openDb({ filename: ':memory:' });
    const count = (t: string) =>
      (db.prepare(`SELECT COUNT(*) c FROM ${t}`).get() as { c: number }).c;
    const total =
      count('categories') +
      count('default_expiry_master') +
      count('consumption_rate_master') +
      count('date_pattern_master') +
      count('category_keywords') +
      count('alert_level_master') +
      count('esp32_command_master');
    expect(total).toBe(61);
    db.close();
  });

  it('各マスタが設計どおりの件数である', () => {
    const db = openDb({ filename: ':memory:' });
    const count = (t: string) =>
      (db.prepare(`SELECT COUNT(*) c FROM ${t}`).get() as { c: number }).c;
    expect(count('categories')).toBe(8);
    expect(count('default_expiry_master')).toBe(8);
    expect(count('consumption_rate_master')).toBe(8);
    expect(count('date_pattern_master')).toBe(6);
    expect(count('category_keywords')).toBe(24);
    expect(count('alert_level_master')).toBe(3);
    expect(count('esp32_command_master')).toBe(4);
    db.close();
  });

  it('シードは冪等(2 回投入しても件数が変わらない)', () => {
    const db = openDb({ filename: ':memory:' });
    const { seedMasters } = require('../../src/lib/db/seed');
    seedMasters(db);
    const c = (db.prepare('SELECT COUNT(*) c FROM categories').get() as { c: number }).c;
    expect(c).toBe(8);
    db.close();
  });
});
