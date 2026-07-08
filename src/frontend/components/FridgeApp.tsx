'use client';

/** 画面全体の組み立て。OCR 失敗時は手動フォームへフォーカス誘導する。 */
import { useRef } from 'react';
import { Header } from './Header';
import { StatusPanel } from './StatusPanel';
import { RegisterForm } from './RegisterForm';
import { ManualForm, type ManualFormHandle } from './ManualForm';
import { ItemList } from './ItemList';

export function FridgeApp() {
  const manualRef = useRef<ManualFormHandle>(null);

  return (
    <>
      <Header />
      <main className="layout">
        <StatusPanel />
        <RegisterForm onNeedManual={() => manualRef.current?.focus()} />
        <ManualForm ref={manualRef} />
        <ItemList />
      </main>
    </>
  );
}
