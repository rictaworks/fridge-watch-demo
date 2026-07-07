/**
 * F3(後半): ESP32 制御。Wi-Fi(HTTP)でコマンド送信する。
 *
 * ルール(設計 1.6 F3):
 *  - 危険レベルはファン30秒作動。クールダウン10分で重複起動を防止
 *  - 送信失敗は最大3回リトライ後スキップし「デバイス未接続」とする(画面表示は継続)
 *
 * 実デバイスへの HTTP 送信は transport として注入する(テスト・環境非依存)。
 * フォールバックで握りつぶさず、成否・試行回数を明示的に返す。
 */
import { config } from '../masters';
import type { AlertDecision } from './alertEvaluator';

/** ESP32 への1回の送信。ACK を受けたら true、失敗は false。例外は失敗と同義に扱う。 */
export type Esp32Transport = (command: string, fanSeconds: number) => Promise<boolean>;

export interface SendOptions {
  now: Date;
  /** 直近にファンを作動させた時刻(クールダウン判定用)。無ければ null。 */
  lastFanAt: Date | null;
  transport: Esp32Transport;
  maxRetries?: number;
  cooldownMinutes?: number;
}

export interface SendResult {
  ok: boolean;
  deviceConnected: boolean;
  command: string;
  fanActivated: boolean;
  fanSeconds: number;
  attempts: number;
}

function withinCooldown(lastFanAt: Date | null, now: Date, cooldownMinutes: number): boolean {
  if (!lastFanAt) return false;
  const elapsedMinutes = (now.getTime() - lastFanAt.getTime()) / 60_000;
  return elapsedMinutes >= 0 && elapsedMinutes < cooldownMinutes;
}

export async function sendToEsp32(
  decision: AlertDecision,
  opts: SendOptions,
): Promise<SendResult> {
  const maxRetries = opts.maxRetries ?? config.esp32.maxRetries;
  const cooldownMinutes = opts.cooldownMinutes ?? config.esp32.cooldownMinutes;

  // 危険レベルかつクールダウン外のときだけファンを作動させる。
  const wantsFan = decision.levelKey === 'danger' && decision.fanSeconds > 0;
  const fanActivated = wantsFan && !withinCooldown(opts.lastFanAt, opts.now, cooldownMinutes);
  const fanSeconds = fanActivated ? decision.fanSeconds : 0;

  let attempts = 0;
  let ok = false;
  for (let i = 0; i < maxRetries; i++) {
    attempts += 1;
    try {
      // eslint-disable-next-line no-await-in-loop
      const ack = await opts.transport(decision.command, fanSeconds);
      if (ack) {
        ok = true;
        break;
      }
    } catch {
      // 通信例外はリトライ対象(握りつぶさず次試行へ)。最終失敗時に deviceConnected=false を返す。
    }
  }

  return {
    ok,
    deviceConnected: ok,
    command: decision.command,
    fanActivated: ok && fanActivated,
    fanSeconds,
    attempts,
  };
}

/** 実 ESP32 への HTTP transport。fetch を用いてコマンドを送る(タイムアウト付き)。 */
export function httpEsp32Transport(baseUrl: string, timeoutMs: number): Esp32Transport {
  return async (command: string, fanSeconds: number): Promise<boolean> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${baseUrl}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, fan_seconds: fanSeconds }),
        signal: controller.signal,
      });
      return res.ok;
    } finally {
      clearTimeout(timer);
    }
  };
}
