/**
 * マスタ 61 件のシード投入。文字列/数値はすべて config/masters.json に分離(ハードコード禁止)。
 * 冪等: INSERT OR REPLACE で再投入しても件数が変わらない。
 */
import type { Database as DB } from 'better-sqlite3';
import masters from '../../config/masters.json';

export interface SeedCounts {
  categories: number;
  default_expiry: number;
  consumption_rate: number;
  date_patterns: number;
  category_keywords: number;
  alert_levels: number;
  esp32_commands: number;
  total: number;
}

export function seedMasters(db: DB): SeedCounts {
  const tx = db.transaction((): SeedCounts => {
    const cat = db.prepare('INSERT OR REPLACE INTO categories (id, key, name) VALUES (?,?,?)');
    for (const c of masters.categories) cat.run(c.id, c.key, c.name);

    const de = db.prepare(
      'INSERT OR REPLACE INTO default_expiry_master (category_id, default_days) VALUES (?,?)',
    );
    for (const d of masters.default_expiry) de.run(d.category_id, d.default_days);

    const cr = db.prepare(
      'INSERT OR REPLACE INTO consumption_rate_master (category_id, percent_per_day) VALUES (?,?)',
    );
    for (const r of masters.consumption_rate) cr.run(r.category_id, r.percent_per_day);

    const dp = db.prepare(
      'INSERT OR REPLACE INTO date_pattern_master (id, label, regex, priority, kind) VALUES (?,?,?,?,?)',
    );
    for (const p of masters.date_patterns) dp.run(p.id, p.label, p.regex, p.priority, p.kind);

    const kw = db.prepare(
      'INSERT OR REPLACE INTO category_keywords (id, category_id, keyword) VALUES (?,?,?)',
    );
    for (const k of masters.category_keywords) kw.run(k.id, k.category_id, k.keyword);

    const al = db.prepare(
      'INSERT OR REPLACE INTO alert_level_master (id, key, name, min_days, led_color) VALUES (?,?,?,?,?)',
    );
    for (const a of masters.alert_levels) al.run(a.id, a.key, a.name, a.min_days, a.led_color);

    const ec = db.prepare(
      'INSERT OR REPLACE INTO esp32_command_master (id, level_key, command, fan_seconds) VALUES (?,?,?,?)',
    );
    for (const e of masters.esp32_commands) ec.run(e.id, e.level_key, e.command, e.fan_seconds);

    const counts: SeedCounts = {
      categories: masters.categories.length,
      default_expiry: masters.default_expiry.length,
      consumption_rate: masters.consumption_rate.length,
      date_patterns: masters.date_patterns.length,
      category_keywords: masters.category_keywords.length,
      alert_levels: masters.alert_levels.length,
      esp32_commands: masters.esp32_commands.length,
      total: 0,
    };
    counts.total =
      counts.categories +
      counts.default_expiry +
      counts.consumption_rate +
      counts.date_patterns +
      counts.category_keywords +
      counts.alert_levels +
      counts.esp32_commands;
    return counts;
  });

  return tx();
}

if (require.main === module) {
  // 手動シード実行用エントリ(npm run seed)。
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { openDb } = require('./index');
  const db = openDb({ seed: false });
  const counts = seedMasters(db);
  process.stdout.write(`seeded masters: ${JSON.stringify(counts)}\n`);
}
