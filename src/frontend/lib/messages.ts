/**
 * i18n メッセージの静的読込。7言語 JSON を束ね、ロケールキーで引く。
 * 文言はここ経由でのみ参照し、コンポーネントにハードコードしない。
 *
 * 既存デモの JSON はドット区切りの「フラットキー」(例: "badge.estimated")。
 * next-intl はドットを階層区切りとして解釈するため、読み込み時にネスト構造へ展開する。
 */
import type { AbstractIntlMessages } from 'next-intl';
import ar from '@/messages/ar.json';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import fr from '@/messages/fr.json';
import ja from '@/messages/ja.json';
import ru from '@/messages/ru.json';
import zh from '@/messages/zh.json';
import { DEFAULT_LOCALE, type Locale } from './config';

type FlatMessages = Record<string, string>;

/** "a.b.c": v のフラットキーを { a: { b: { c: v } } } に展開する。 */
export function unflatten(flat: FlatMessages): AbstractIntlMessages {
  const root: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let node = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const seg = parts[i];
      if (typeof node[seg] !== 'object' || node[seg] === null) {
        node[seg] = {};
      }
      node = node[seg] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = value;
  }
  return root as AbstractIntlMessages;
}

const RAW: Record<Locale, FlatMessages> = { ja, en, fr, zh, ru, es, ar };

const MESSAGES: Record<Locale, AbstractIntlMessages> = Object.fromEntries(
  (Object.entries(RAW) as [Locale, FlatMessages][]).map(([loc, flat]) => [loc, unflatten(flat)]),
) as Record<Locale, AbstractIntlMessages>;

export function getMessages(locale: Locale): AbstractIntlMessages {
  return MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
}
