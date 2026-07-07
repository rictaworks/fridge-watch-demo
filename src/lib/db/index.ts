/**
 * SQLite 接続ファクトリ。DB パスは環境変数 FW_DB_PATH を参照(未設定は data/fridge.db)。
 * テストは ':memory:' を渡してインメモリで実行する。
 */
import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { SCHEMA_SQL } from './schema';
import { seedMasters } from './seed';

export type { DB };

export interface OpenOptions {
  /** ':memory:' でインメモリ。省略時は環境変数 or 既定パス。 */
  filename?: string;
  /** マスタ 61 件を投入するか(既定 true)。 */
  seed?: boolean;
}

export function openDb(options: OpenOptions = {}): DB {
  const filename =
    options.filename ?? process.env.FW_DB_PATH ?? path.join(process.cwd(), 'data', 'fridge.db');

  if (filename !== ':memory:') {
    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);

  if (options.seed !== false) {
    seedMasters(db);
  }
  return db;
}
