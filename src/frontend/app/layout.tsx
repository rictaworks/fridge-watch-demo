import type { Metadata } from 'next';
// Font Awesome の CSS を明示 import(autoAddCss は無効化済み。SSR での FOUC を防ぐ)。
import '@fortawesome/fontawesome-svg-core/styles.css';
import './globals.css';
import { DEFAULT_LOCALE } from '@/lib/config';

export const metadata: Metadata = {
  title: 'スマート冷蔵庫管理(デモ版)',
  description: '食材残量・賞味期限の自動検知(デモ版)',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 初期は既定ロケール(ja / LTR)。クライアントで localStorage に応じ lang/dir を更新する。
  // プロバイダは page 側の単一クライアントツリー(AppRoot)で配布する。
  return (
    <html lang={DEFAULT_LOCALE} dir="ltr">
      <body>{children}</body>
    </html>
  );
}
