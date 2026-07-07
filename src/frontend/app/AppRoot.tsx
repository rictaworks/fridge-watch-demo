'use client';

/**
 * クライアント側の単一ルート。プロバイダ群と画面本体を同一クライアントツリーで構成する。
 * (Server Component の children スロット経由だと SSR 時に next-intl コンテキストが伝播しないため、
 *  ここで一体化して確実にコンテキストを配布する。)
 */
import { Providers } from './providers';
import { FridgeApp } from '@/components/FridgeApp';

export default function AppRoot() {
  return (
    <Providers>
      <FridgeApp />
    </Providers>
  );
}
