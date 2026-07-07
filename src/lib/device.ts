/**
 * ESP32 デバイス接続の環境分岐。
 *  - virtual(既定): 画面デモ用の仮想デバイス。コマンドを受理し状態を保持する。
 *  - http:          実 ESP32 へ HTTP 送信(config.esp32.baseUrl)。
 *  - off:           デバイス無し。常に失敗させ「デバイス未接続」を再現する。
 * 環境変数 FW_ESP32_MODE で切替(未設定は virtual)。
 */
import type { Esp32Transport } from './domain/esp32Controller';
import { httpEsp32Transport } from './domain/esp32Controller';
import { config } from './masters';

export interface DeviceState {
  command: string;
  fanSeconds: number;
  updatedAt: string | null;
}

export class VirtualDevice {
  private state: DeviceState = { command: 'LED_OFF', fanSeconds: 0, updatedAt: null };

  transport(): Esp32Transport {
    return async (command: string, fanSeconds: number): Promise<boolean> => {
      this.state = { command, fanSeconds, updatedAt: new Date().toISOString() };
      return true;
    };
  }

  snapshot(): DeviceState {
    return { ...this.state };
  }
}

export type Esp32Mode = 'virtual' | 'http' | 'off';

export function resolveEsp32Mode(env: NodeJS.ProcessEnv): Esp32Mode {
  const raw = (env.FW_ESP32_MODE ?? 'virtual').toLowerCase();
  if (raw === 'http' || raw === 'off') return raw;
  return 'virtual';
}

export interface DeviceBinding {
  mode: Esp32Mode;
  transport: Esp32Transport;
  virtual: VirtualDevice | null;
}

/** 環境に応じた transport を組み立てる。virtual のときのみ状態参照用インスタンスを返す。 */
export function bindDevice(env: NodeJS.ProcessEnv): DeviceBinding {
  const mode = resolveEsp32Mode(env);
  if (mode === 'http') {
    return {
      mode,
      transport: httpEsp32Transport(config.esp32.baseUrl, config.esp32.timeoutMs),
      virtual: null,
    };
  }
  if (mode === 'off') {
    return { mode, transport: async () => false, virtual: null };
  }
  const virtual = new VirtualDevice();
  return { mode, transport: virtual.transport(), virtual };
}
