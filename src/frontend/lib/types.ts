/**
 * バックエンド(FridgeView)と一致させる型定義。
 * 参照元: src/lib/service.ts の ItemState / AlertState / FridgeView。
 */

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
  command?: string;
  fanActivated: boolean;
  deviceConnected: boolean;
  minDays: number | null;
}

export interface FridgeView {
  items: ItemState[];
  alert: AlertState;
}

export interface Category {
  id: number;
  key: string;
  name: string;
}

export interface MastersResponse {
  categories: Category[];
  locales: string[];
  rtlLocales: string[];
}

/** OCR で日付が読めず手動入力へ誘導する応答。 */
export interface NeedManualResponse {
  needManual: true;
}

export function isNeedManual(v: unknown): v is NeedManualResponse {
  return typeof v === 'object' && v !== null && (v as { needManual?: unknown }).needManual === true;
}

/** API 呼び出しの正規化結果。フォールバックで握りつぶさず、呼び出し側で分岐する。 */
export interface ApiResult<T> {
  ok: boolean;
  status: number;
  body: T | null;
}
