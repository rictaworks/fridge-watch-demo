/**
 * F3(前半): アラート判定。セッション内全食材の最小残日数からレベルを決める。
 *
 * ルール(設計 1.6 F3):
 *  - 安全(残4日以上)=緑 / 注意(残1〜3日)=黄 / 危険(当日以下・期限切れ)=赤
 *  - 食材0件は消灯コマンド
 */
import type { AlertLevel, Esp32Command } from '../db/types';
import { alertLevels as defaultLevels, esp32Commands as defaultCommands } from '../masters';
import { jstTodayIso, diffDaysIso } from '../util/time';

export type LevelKey = 'safe' | 'warning' | 'danger' | 'off';

export interface AlertDecision {
  levelKey: LevelKey;
  levelId: number | null;
  ledColor: string;
  command: string;
  fanSeconds: number;
  /** 最小残日数(食材0件のときは null)。 */
  minDays: number | null;
}

export interface EvaluateOptions {
  levels?: AlertLevel[];
  commands?: Esp32Command[];
}

function commandFor(levelKey: string, commands: Esp32Command[]): Esp32Command {
  const cmd = commands.find((c) => c.level_key === levelKey);
  if (!cmd) {
    throw new Error(`esp32_command_master にレベル ${levelKey} が存在しません`);
  }
  return cmd;
}

export function evaluateAlert(
  expiryDates: string[],
  now: Date,
  opts: EvaluateOptions = {},
): AlertDecision {
  const levels = opts.levels ?? defaultLevels;
  const commands = opts.commands ?? defaultCommands;

  if (expiryDates.length === 0) {
    const off = commandFor('off', commands);
    return {
      levelKey: 'off',
      levelId: null,
      ledColor: 'off',
      command: off.command,
      fanSeconds: off.fan_seconds,
      minDays: null,
    };
  }

  const todayIso = jstTodayIso(now);
  const minDays = expiryDates
    .map((e) => diffDaysIso(todayIso, e))
    .reduce((min, d) => (d < min ? d : min));

  // min_days 降順に並べ、最初に minDays >= min_days を満たすレベルを採用する。
  const ordered = [...levels].sort((a, b) => b.min_days - a.min_days);
  const level = ordered.find((l) => minDays >= l.min_days);
  if (!level) {
    throw new Error('アラートレベルマスタが不正です(該当レベルなし)');
  }
  const cmd = commandFor(level.key, commands);

  return {
    levelKey: level.key,
    levelId: level.id,
    ledColor: level.led_color,
    command: cmd.command,
    fanSeconds: cmd.fan_seconds,
    minDays,
  };
}
