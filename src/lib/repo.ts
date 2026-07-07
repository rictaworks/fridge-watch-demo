/**
 * データアクセス層。全クエリでセッションIDによる所有スコープを強制する。
 * セッションを跨いだ参照・更新・削除は原理的に不可能な形にする。
 */
import type { Database as DB } from 'better-sqlite3';
import type { FoodItem } from './db/types';

export interface NewFoodItem {
  session_id: string;
  category_id: number;
  name: string | null;
  expiry_date: string;
  is_estimated: boolean;
  registered_at: string;
}

export class FoodRepo {
  constructor(private readonly db: DB) {}

  insertItem(item: NewFoodItem): number {
    const info = this.db
      .prepare(
        `INSERT INTO food_items (session_id, category_id, name, expiry_date, is_estimated, registered_at)
         VALUES (@session_id, @category_id, @name, @expiry_date, @is_estimated, @registered_at)`,
      )
      .run({ ...item, is_estimated: item.is_estimated ? 1 : 0 });
    return Number(info.lastInsertRowid);
  }

  /** 自セッションの食材のみを返す。 */
  listItems(sessionId: string): FoodItem[] {
    return this.db
      .prepare(
        'SELECT * FROM food_items WHERE session_id = ? ORDER BY expiry_date ASC, id ASC',
      )
      .all(sessionId) as FoodItem[];
  }

  /** 自セッションかつ指定IDの食材を返す(他セッションは null)。 */
  getItem(sessionId: string, id: number): FoodItem | null {
    const row = this.db
      .prepare('SELECT * FROM food_items WHERE id = ? AND session_id = ?')
      .get(id, sessionId);
    return (row as FoodItem) ?? null;
  }

  /** 自セッションの食材を削除する(所有者不一致なら 0 件)。補正履歴も併せて削除。 */
  deleteItem(sessionId: string, id: number): boolean {
    const tx = this.db.transaction(() => {
      this.db
        .prepare('DELETE FROM remain_adjustments WHERE food_item_id = ? AND session_id = ?')
        .run(id, sessionId);
      const info = this.db
        .prepare('DELETE FROM food_items WHERE id = ? AND session_id = ?')
        .run(id, sessionId);
      return info.changes > 0;
    });
    return tx();
  }

  /** 補正を記録する(所有者チェック済み前提)。 */
  insertAdjustment(sessionId: string, foodItemId: number, percent: number, at: string): void {
    this.db
      .prepare(
        `INSERT INTO remain_adjustments (food_item_id, session_id, adjusted_percent, adjusted_at)
         VALUES (?,?,?,?)`,
      )
      .run(foodItemId, sessionId, percent, at);
  }

  /** 食材の直近補正(値・時刻)を返す。無ければ null。 */
  latestAdjustment(
    sessionId: string,
    foodItemId: number,
  ): { adjusted_percent: number; adjusted_at: string } | null {
    const row = this.db
      .prepare(
        `SELECT adjusted_percent, adjusted_at FROM remain_adjustments
         WHERE food_item_id = ? AND session_id = ?
         ORDER BY adjusted_at DESC, id DESC LIMIT 1`,
      )
      .get(foodItemId, sessionId);
    return (row as { adjusted_percent: number; adjusted_at: string }) ?? null;
  }

  /** アラート発火を記録する。 */
  insertAlertLog(sessionId: string, levelId: number, firedAt: string, fanActivated: boolean): void {
    this.db
      .prepare(
        'INSERT INTO alert_logs (session_id, level_id, fired_at, fan_activated) VALUES (?,?,?,?)',
      )
      .run(sessionId, levelId, firedAt, fanActivated ? 1 : 0);
  }

  /**
   * 自セッションのトランザクションデータのみを削除する(手動リセット用)。
   * 全セッションを消す全体リセット(F4 スケジューラ)とは別物で、他人のデータには触れない。
   */
  clearSession(sessionId: string): { food_items: number; remain_adjustments: number; alert_logs: number } {
    const tx = this.db.transaction(() => {
      const adj = this.db
        .prepare('DELETE FROM remain_adjustments WHERE session_id = ?')
        .run(sessionId).changes;
      const items = this.db
        .prepare('DELETE FROM food_items WHERE session_id = ?')
        .run(sessionId).changes;
      const alerts = this.db
        .prepare('DELETE FROM alert_logs WHERE session_id = ?')
        .run(sessionId).changes;
      return { food_items: items, remain_adjustments: adj, alert_logs: alerts };
    });
    return tx();
  }

  /** 直近にファンを作動させた時刻(クールダウン判定用)。無ければ null。 */
  lastFanAt(sessionId: string): Date | null {
    const row = this.db
      .prepare(
        `SELECT fired_at FROM alert_logs
         WHERE session_id = ? AND fan_activated = 1
         ORDER BY fired_at DESC, id DESC LIMIT 1`,
      )
      .get(sessionId) as { fired_at: string } | undefined;
    return row ? new Date(row.fired_at) : null;
  }
}
