/**
 * F2: 残量推定(ルールベース)。
 *
 * ルール(設計 1.6 F2):
 *  - 残量% = 基準残量 −(基準時刻からの経過日数 × カテゴリ別日次消費率)
 *  - 基準は最新の手動補正(値・時刻)、無ければ登録時(100%)
 *  - 結果は 0〜100% にクランプ。補正入力も 0〜100% にクランプ
 *  - 端末時刻異常(基準時刻より過去)は基準残量をそのまま表示
 *  - 残量 20% 以下で補充推奨フラグ
 */
import { config } from '../masters';
import { elapsedDays } from '../util/time';

export interface EstimateInput {
  /** 基準残量(直近補正値、無ければ 100)。 */
  basePercent: number;
  /** 基準時刻(直近補正時刻、無ければ登録時刻)。 */
  baseAt: Date;
  /** カテゴリ別日次消費率(%/日)。 */
  ratePerDay: number;
  now: Date;
}

export interface EstimateResult {
  percent: number;
  restock: boolean;
}

/** 0〜100 にクランプし整数へ丸める(補正入力にも使用)。 */
export function clampPercent(value: number): number {
  const { min, max } = config.remain;
  const rounded = Math.round(value);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

export function estimateRemain(input: EstimateInput): EstimateResult {
  // 端末時刻異常(now < baseAt)は elapsedDays が 0 を返すため基準残量のまま。
  const days = elapsedDays(input.baseAt, input.now);
  const raw = input.basePercent - days * input.ratePerDay;
  const percent = clampPercent(raw);
  const restock = percent <= config.remain.restockThreshold;
  return { percent, restock };
}
