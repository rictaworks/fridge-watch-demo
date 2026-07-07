/**
 * F1: カテゴリ自動判定。抽出テキストをキーワード辞書と照合してカテゴリ ID を決める。
 * 未ヒット時は「その他」。フォールバックで握りつぶさず、明示的に otherId を返す。
 */
import type { CategoryKeyword } from '../db/types';

export function classifyCategory(
  text: string,
  keywords: CategoryKeyword[],
  otherId: number,
): number {
  if (typeof text !== 'string' || text.length === 0) {
    return otherId;
  }
  // 辞書登録順に走査し、最初に本文へ含まれるキーワードのカテゴリを採用する。
  for (const entry of keywords) {
    if (entry.keyword.length > 0 && text.includes(entry.keyword)) {
      return entry.category_id;
    }
  }
  return otherId;
}
