'use client';

/** クライアント側プロバイダの集約(ロケール → UI(トースト/モーダル) → 冷蔵庫状態)。 */
import { LocaleProvider } from '@/components/LocaleProvider';
import { UiProvider } from '@/components/UiProvider';
import { FridgeProvider } from '@/components/FridgeProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <UiProvider>
        <FridgeProvider>{children}</FridgeProvider>
      </UiProvider>
    </LocaleProvider>
  );
}
