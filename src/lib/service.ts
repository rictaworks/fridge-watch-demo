/**
 * サービス層。F1(登録)・F2(残量)・F3(アラート/ESP32)を束ねる。
 * すべてセッションIDスコープで動作し、他セッションのデータには一切触れない。
 */
import type { Database as DB } from 'better-sqlite3';
import { FoodRepo } from './repo';
import type { FoodItem } from './db/types';
import {
  categories,
  categoryKeywords,
  OTHER_CATEGORY_ID,
  defaultDaysFor,
  consumptionRateFor,
} from './masters';
import { classifyCategory } from './domain/categoryClassifier';
import { resolveExpiry } from './domain/expiryResolver';
import { estimateRemain, clampPercent } from './domain/remainEstimator';
import { evaluateAlert, type AlertDecision } from './domain/alertEvaluator';
import { sendToEsp32, type Esp32Transport } from './domain/esp32Controller';
import { diffDaysIso, jstTodayIso } from './util/time';

export interface ItemState {
  id: number;
  name: string | null;
  categoryId: number;
  categoryName: string;
  expiryDate: string;
  isEstimated: boolean;
  remainingDays: number;
  remainPercent: number;
  restock: boolean;
}

export interface AlertState {
  levelKey: string;
  ledColor: string;
  command: string;
  fanActivated: boolean;
  deviceConnected: boolean;
  minDays: number | null;
}

export interface FridgeView {
  items: ItemState[];
  alert: AlertState;
}

export interface OcrInput {
  name?: string | null;
  ocrText: string;
}

export interface ManualInput {
  name?: string | null;
  categoryId: number;
  expiryDate: string;
}

export class FridgeService {
  private readonly repo: FoodRepo;

  constructor(db: DB, private readonly transport: Esp32Transport) {
    this.repo = new FoodRepo(db);
  }

  private categoryName(id: number): string {
    return categories.find((c) => c.id === id)?.name ?? '';
  }

  /** F1: OCR テキストから登録。ocrText が空(完全失敗)なら needManual を返し登録しない。 */
  async registerFromOcr(
    sessionId: string,
    input: OcrInput,
    now: Date,
  ): Promise<FridgeView | { needManual: true }> {
    const text = (input.ocrText ?? '').trim();
    if (text.length === 0) {
      return { needManual: true };
    }
    const categoryId = classifyCategory(text, categoryKeywords, OTHER_CATEGORY_ID);
    const expiry = resolveExpiry(text, { now, defaultDays: defaultDaysFor(categoryId) });
    this.repo.insertItem({
      session_id: sessionId,
      category_id: categoryId,
      name: input.name ?? text.slice(0, 40),
      expiry_date: expiry.expiryDate,
      is_estimated: expiry.isEstimated,
      registered_at: now.toISOString(),
    });
    return this.notifyAndView(sessionId, now);
  }

  /** F1(手動フォールバック): カテゴリと期限を直接指定して登録。 */
  async registerManual(sessionId: string, input: ManualInput, now: Date): Promise<FridgeView> {
    this.repo.insertItem({
      session_id: sessionId,
      category_id: input.categoryId,
      name: input.name ?? null,
      expiry_date: input.expiryDate,
      is_estimated: false,
      registered_at: now.toISOString(),
    });
    return this.notifyAndView(sessionId, now);
  }

  /** F2: 残量手動補正。所有者不一致は null。 */
  async adjust(
    sessionId: string,
    itemId: number,
    percent: number,
    now: Date,
  ): Promise<FridgeView | null> {
    const item = this.repo.getItem(sessionId, itemId);
    if (!item) return null;
    this.repo.insertAdjustment(sessionId, itemId, clampPercent(percent), now.toISOString());
    return this.notifyAndView(sessionId, now);
  }

  /** 食材削除。所有者不一致は null。 */
  async remove(sessionId: string, itemId: number, now: Date): Promise<FridgeView | null> {
    const ok = this.repo.deleteItem(sessionId, itemId);
    if (!ok) return null;
    return this.notifyAndView(sessionId, now);
  }

  /** 一覧取得(残量・アラート込み)。ESP32 へも現在レベルを反映する。 */
  async view(sessionId: string, now: Date): Promise<FridgeView> {
    return this.notifyAndView(sessionId, now);
  }

  /** 手動リセット: 自セッションのデータのみ削除し、消灯まで反映する。 */
  async clearOwn(
    sessionId: string,
    now: Date,
  ): Promise<{ view: FridgeView; deleted: ReturnType<FoodRepo['clearSession']> }> {
    const deleted = this.repo.clearSession(sessionId);
    const view = await this.notifyAndView(sessionId, now);
    return { view, deleted };
  }

  private computeItemState(item: FoodItem, now: Date): ItemState {
    const rate = consumptionRateFor(item.category_id);
    const adj = this.repo.latestAdjustment(item.session_id, item.id);
    const basePercent = adj ? adj.adjusted_percent : 100;
    const baseAt = adj ? new Date(adj.adjusted_at) : new Date(item.registered_at);
    const remain = estimateRemain({ basePercent, baseAt, ratePerDay: rate, now });
    const remainingDays = diffDaysIso(jstTodayIso(now), item.expiry_date);
    return {
      id: item.id,
      name: item.name,
      categoryId: item.category_id,
      categoryName: this.categoryName(item.category_id),
      expiryDate: item.expiry_date,
      isEstimated: item.is_estimated === 1,
      remainingDays,
      remainPercent: remain.percent,
      restock: remain.restock,
    };
  }

  /** F3: アラート判定 → ESP32 送信 → ログ記録。そのうえで一覧ビューを返す。 */
  private async notifyAndView(sessionId: string, now: Date): Promise<FridgeView> {
    const items = this.repo.listItems(sessionId).map((i) => this.computeItemState(i, now));
    const decision: AlertDecision = evaluateAlert(
      items.map((i) => i.expiryDate),
      now,
    );
    const alert = await this.dispatchDevice(sessionId, decision, now);
    return { items, alert };
  }

  private async dispatchDevice(
    sessionId: string,
    decision: AlertDecision,
    now: Date,
  ): Promise<AlertState> {
    const lastFanAt = this.repo.lastFanAt(sessionId);
    const result = await sendToEsp32(decision, {
      now,
      lastFanAt,
      transport: this.transport,
    });

    // 送信可否に関わらず、危険レベル発火は履歴に残す(fan_activated は実結果)。
    if (decision.levelKey !== 'off' && decision.levelId !== null) {
      this.repo.insertAlertLog(sessionId, decision.levelId, now.toISOString(), result.fanActivated);
    }

    return {
      levelKey: decision.levelKey,
      ledColor: decision.ledColor,
      command: decision.command,
      fanActivated: result.fanActivated,
      deviceConnected: result.deviceConnected,
      minDays: decision.minDays,
    };
  }
}
