import { evaluateAlert } from '../../src/lib/domain/alertEvaluator';
import { sendToEsp32 } from '../../src/lib/domain/esp32Controller';

const NOW = new Date('2026-07-07T04:00:00Z'); // JST 2026-07-07

function iso(days: number): string {
  // 今日(JST 07-07)から days 日後の ISO
  const base = Date.UTC(2026, 6, 7, 3, 0, 0); // JST 正午
  const dt = new Date(base + days * 86_400_000 + 9 * 3600_000);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dt.getUTCDate(),
  ).padStart(2, '0')}`;
}

describe('F3 AlertEvaluator 最小残日数→レベル', () => {
  it('食材0件は消灯コマンド', () => {
    const d = evaluateAlert([], NOW);
    expect(d.levelKey).toBe('off');
    expect(d.command).toBe('LED_OFF');
  });

  it('残5日は安全(緑)', () => {
    const d = evaluateAlert([iso(5)], NOW);
    expect(d.levelKey).toBe('safe');
    expect(d.ledColor).toBe('green');
    expect(d.command).toBe('LED_GREEN');
  });

  it('残4日は安全(境界)', () => {
    expect(evaluateAlert([iso(4)], NOW).levelKey).toBe('safe');
  });

  it('残3日は注意(黄)', () => {
    const d = evaluateAlert([iso(3)], NOW);
    expect(d.levelKey).toBe('warning');
    expect(d.ledColor).toBe('yellow');
  });

  it('残1日は注意(境界)', () => {
    expect(evaluateAlert([iso(1)], NOW).levelKey).toBe('warning');
  });

  it('当日(残0日)は危険(赤+ファン)', () => {
    const d = evaluateAlert([iso(0)], NOW);
    expect(d.levelKey).toBe('danger');
    expect(d.ledColor).toBe('red');
    expect(d.command).toBe('LED_RED_FAN');
    expect(d.fanSeconds).toBe(30);
  });

  it('期限切れ(残-2日)は危険', () => {
    expect(evaluateAlert([iso(-2)], NOW).levelKey).toBe('danger');
  });

  it('複数食材は最小残日数でレベルを決める', () => {
    const d = evaluateAlert([iso(10), iso(2), iso(6)], NOW);
    expect(d.levelKey).toBe('warning');
    expect(d.minDays).toBe(2);
  });
});

describe('F3 Esp32Controller HTTP制御(リトライ・クールダウン・ファン)', () => {
  const okTransport = async () => true;

  it('危険かつ直近ファン無し → ファン30秒作動', async () => {
    const calls: { command: string; fanSeconds: number }[] = [];
    const r = await sendToEsp32(evaluateAlert([iso(0)], NOW), {
      now: NOW,
      lastFanAt: null,
      transport: async (command, fanSeconds) => {
        calls.push({ command, fanSeconds });
        return true;
      },
    });
    expect(r.ok).toBe(true);
    expect(r.fanActivated).toBe(true);
    expect(calls[0]).toEqual({ command: 'LED_RED_FAN', fanSeconds: 30 });
  });

  it('クールダウン中(5分前にファン)はファンを起動しない', async () => {
    const r = await sendToEsp32(evaluateAlert([iso(0)], NOW), {
      now: NOW,
      lastFanAt: new Date(NOW.getTime() - 5 * 60_000),
      transport: okTransport,
    });
    expect(r.fanActivated).toBe(false);
  });

  it('クールダウン経過後(11分前)はファンを再起動する', async () => {
    const r = await sendToEsp32(evaluateAlert([iso(0)], NOW), {
      now: NOW,
      lastFanAt: new Date(NOW.getTime() - 11 * 60_000),
      transport: okTransport,
    });
    expect(r.fanActivated).toBe(true);
  });

  it('送信失敗2回のあと成功すれば ok(3回目で成功)', async () => {
    let attempts = 0;
    const r = await sendToEsp32(evaluateAlert([iso(5)], NOW), {
      now: NOW,
      lastFanAt: null,
      transport: async () => {
        attempts += 1;
        return attempts >= 3;
      },
    });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(3);
    expect(r.deviceConnected).toBe(true);
  });

  it('3回リトライしても失敗ならスキップしデバイス未接続とする', async () => {
    const r = await sendToEsp32(evaluateAlert([iso(5)], NOW), {
      now: NOW,
      lastFanAt: null,
      transport: async () => false,
    });
    expect(r.ok).toBe(false);
    expect(r.deviceConnected).toBe(false);
    expect(r.attempts).toBe(3);
  });

  it('安全レベルはファンを起動しない', async () => {
    const r = await sendToEsp32(evaluateAlert([iso(5)], NOW), {
      now: NOW,
      lastFanAt: null,
      transport: okTransport,
    });
    expect(r.command).toBe('LED_GREEN');
    expect(r.fanActivated).toBe(false);
  });
});
