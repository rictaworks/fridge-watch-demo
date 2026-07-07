/**
 * F4: 日次リセット(JST 03:00)。
 *
 * ルール(設計 1.6 F4):
 *  - JST 03:00 にトランザクションデータ(食材・補正履歴・アラート履歴・セッション)を全削除
 *  - マスタデータは保持
 *  - リセット実行中のアクセスには「リセット中」応答を返す(状態は ResetGate が保持)
 */
import type { Database as DB } from 'better-sqlite3';
import { TRANSACTION_TABLES } from '../db/schema';
import { config } from '../masters';
import { jstYmd } from '../util/time';

export interface ResetResult {
  deleted: Record<string, number>;
  total: number;
}

/** トランザクションテーブルを全削除する(マスタは触らない)。外部キー順に削除。 */
export function resetTransactions(db: DB): ResetResult {
  const deleted: Record<string, number> = {};
  const tx = db.transaction(() => {
    for (const table of TRANSACTION_TABLES) {
      const info = db.prepare(`DELETE FROM ${table}`).run();
      deleted[table] = info.changes;
    }
  });
  tx();
  const total = Object.values(deleted).reduce((a, b) => a + b, 0);
  return { deleted, total };
}

/** 現在時刻が JST リセット時刻(既定 03:00)の分に一致するか。 */
export function isResetWindow(now: Date): boolean {
  const shifted = new Date(now.getTime() + 9 * 3600_000);
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  return hour === config.reset.hourJst && minute === config.reset.minuteJst;
}

/**
 * リセット中フラグ。実行中は「リセット中」応答を返すために参照する。
 * グローバル変数を避け、インスタンスとして生成・注入する。
 */
export class ResetGate {
  private resetting = false;

  isResetting(): boolean {
    return this.resetting;
  }

  /** リセットを排他実行する。実行中は resetting=true。 */
  run(db: DB): ResetResult {
    this.resetting = true;
    try {
      return resetTransactions(db);
    } finally {
      this.resetting = false;
    }
  }
}

/** 現在の JST 日付を 'YYYY-MM-DD' で返す(スケジューラの重複実行防止キー用)。 */
export function jstDateKey(now: Date): string {
  const { year, month, day } = jstYmd(now);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
