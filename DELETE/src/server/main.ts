/**
 * サーバ起動エントリ。環境判定でデバイス接続・DBパス・ポートを分岐する。
 * 日次リセットは JST 03:00 に実行する軽量スケジューラを内包(外部依存なし)。
 */
import { openDb } from '../lib/db';
import { bindDevice } from '../lib/device';
import { ResetGate, isResetWindow, jstDateKey } from '../lib/domain/dailyReset';
import { buildApp } from './app';

function startResetScheduler(db: ReturnType<typeof openDb>, gate: ResetGate): NodeJS.Timeout {
  let lastResetKey = '';
  // 30 秒間隔で JST 03:00 到達を監視し、当日未実行なら1度だけリセットする。
  return setInterval(() => {
    const now = new Date();
    const key = jstDateKey(now);
    if (isResetWindow(now) && lastResetKey !== key) {
      lastResetKey = key;
      const result = gate.run(db);
      process.stdout.write(`[reset] ${key} done: ${JSON.stringify(result.deleted)}\n`);
    }
  }, 30_000);
}

function main(): void {
  const port = Number(process.env.PORT ?? 3000);
  const db = openDb();
  const device = bindDevice(process.env);
  const resetGate = new ResetGate();
  const app = buildApp({ db, device, resetGate });

  startResetScheduler(db, resetGate);

  app.listen(port, () => {
    process.stdout.write(
      `fridge-watch-demo listening on http://localhost:${port} (esp32=${device.mode})\n`,
    );
  });
}

main();
