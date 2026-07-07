/**
 * セッション管理(デモ版: 認証なし)。
 * セッションIDを全トランザクションテーブルのオーナーキーとして扱い、
 * セッションを跨いだ参照・操作を禁止する。個人情報は保持しない。
 */
import type { Database as DB } from 'better-sqlite3';
import { randomBytes } from 'crypto';
import { config } from './masters';

export class SessionManager {
  constructor(private readonly db: DB) {}

  /** 新規セッションIDを暗号論的乱数で発行する。 */
  private generateId(): string {
    return randomBytes(config.session.idBytes).toString('hex');
  }

  /**
   * Cookie 由来のセッションIDを検証し、存在すれば last_accessed を更新して返す。
   * 未存在/不正なら新規発行してレコードを作成する。
   * @returns 有効なセッションID
   */
  ensure(cookieId: string | undefined, now: Date): string {
    const nowIso = now.toISOString();
    if (cookieId && /^[0-9a-f]+$/.test(cookieId)) {
      const row = this.db
        .prepare('SELECT session_id FROM sessions WHERE session_id = ?')
        .get(cookieId);
      if (row) {
        this.db
          .prepare('UPDATE sessions SET last_accessed_at = ? WHERE session_id = ?')
          .run(nowIso, cookieId);
        return cookieId;
      }
    }
    const id = this.generateId();
    this.db
      .prepare(
        'INSERT INTO sessions (session_id, created_at, last_accessed_at) VALUES (?,?,?)',
      )
      .run(id, nowIso, nowIso);
    return id;
  }
}
