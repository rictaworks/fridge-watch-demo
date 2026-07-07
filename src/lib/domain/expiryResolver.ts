/**
 * F1: 賞味期限の自動検知(OCR テキスト + 日付パターンマスタ + ルールベース)。
 *
 * ルール(設計 1.6 F1):
 *  - 「消費期限」近傍の日付を最優先、なければ最も未来の日付を採用
 *  - 年省略(MM.DD)は「今日以降で最も近い未来日」に補完(年跨ぎ対応)
 *  - YY.MM.DD は 2000 年代として補完
 *  - 今日から2年超先は誤読として棄却
 *  - 採用可能な日付が無ければカテゴリ別デフォルト期限で補完し is_estimated=true
 *  - 過去日でも採用は許可(即時アラート対象)
 */
import type { DatePattern } from '../db/types';
import { datePatterns as defaultPatterns, config } from '../masters';
import { jstTodayIso, jstYmd, toIsoDate, addDaysIso, diffDaysIso } from '../util/time';

export interface ResolveOptions {
  now: Date;
  /** カテゴリ別デフォルト期限日数(採用不可時の補完に使用)。 */
  defaultDays: number;
  patterns?: DatePattern[];
  /** 今日からこの日数を超える未来日は誤読として棄却(既定 730=2年)。 */
  rejectOverDays?: number;
}

export interface ExpiryResult {
  expiryDate: string; // 'YYYY-MM-DD'(JST)
  isEstimated: boolean;
  source: 'ocr' | 'default';
  matchedText: string | null;
}

interface Candidate {
  iso: string;
  prefer: boolean;
  matchedText: string;
}

/** month/day を検証し、成立するなら ISO 文字列を返す(不正日付は null)。 */
function validIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null; // 2月30日などのオーバーフローを棄却
  }
  return toIsoDate(year, month, day);
}

/** 年省略 MM.DD を「今日以降で最も近い未来日」に補完する。 */
function completeYear(month: number, day: number, todayIso: string, thisYear: number): string | null {
  const thisYearIso = validIso(thisYear, month, day);
  if (thisYearIso && diffDaysIso(todayIso, thisYearIso) >= 0) {
    return thisYearIso;
  }
  return validIso(thisYear + 1, month, day);
}

export function resolveExpiry(text: string, opts: ResolveOptions): ExpiryResult {
  const patterns = opts.patterns ?? defaultPatterns;
  const rejectOverDays = opts.rejectOverDays ?? config.expiry.rejectOverDays;
  const todayIso = jstTodayIso(opts.now);
  const thisYear = jstYmd(opts.now).year;
  const maxIso = addDaysIso(todayIso, rejectOverDays);

  const candidates: Candidate[] = [];

  for (const pattern of patterns) {
    const re = new RegExp(pattern.regex, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index === re.lastIndex) re.lastIndex++; // 空マッチ対策
      let iso: string | null = null;
      if (pattern.kind === 'md') {
        iso = completeYear(parseInt(m[1], 10), parseInt(m[2], 10), todayIso, thisYear);
      } else if (pattern.kind === 'yymd') {
        iso = validIso(2000 + parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
      } else {
        // ymd / prefer_ymd
        iso = validIso(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
      }
      if (!iso) continue;
      // 2年超先は誤読として棄却(過去日は許可)。
      if (diffDaysIso(todayIso, iso) > rejectOverDays) continue;
      // maxIso との整合(念のため二重チェック)。
      if (iso > maxIso) continue;
      candidates.push({ iso, prefer: pattern.kind === 'prefer_ymd', matchedText: m[0] });
    }
  }

  if (candidates.length === 0) {
    // 採用可能な日付なし → デフォルト期限で補完(推定)。
    return {
      expiryDate: addDaysIso(todayIso, opts.defaultDays),
      isEstimated: true,
      source: 'default',
      matchedText: null,
    };
  }

  // 「消費期限」近傍(prefer)を最優先。無ければ全候補から最も未来を採用。
  const preferred = candidates.filter((c) => c.prefer);
  const pool = preferred.length > 0 ? preferred : candidates;
  const chosen = pool.reduce((best, c) => (c.iso > best.iso ? c : best));

  return {
    expiryDate: chosen.iso,
    isEstimated: false,
    source: 'ocr',
    matchedText: chosen.matchedText,
  };
}
