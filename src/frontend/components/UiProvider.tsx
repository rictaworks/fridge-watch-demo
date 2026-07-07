'use client';

/**
 * ネイティブ alert()/confirm() の代替。独自トーストと確認モーダルを提供する。
 * showToast / confirm を context で配布し、任意コンポーネントから利用可能にする。
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslations } from 'next-intl';

interface ToastState {
  id: number;
  message: string;
  error: boolean;
}

interface ConfirmState {
  title: string;
  body: string;
  resolve: (value: boolean) => void;
}

interface UiContextValue {
  showToast: (message: string, error?: boolean) => void;
  confirm: (title: string, body: string) => Promise<boolean>;
}

const UiContext = createContext<UiContextValue | null>(null);

export function useUi(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) {
    throw new Error('useUi must be used within UiProvider');
  }
  return ctx;
}

const TOAST_DURATION_MS = 3200;

export function UiProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, error = false) => {
    const id = Date.now();
    setToast({ id, message, error });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setToast((cur) => (cur && cur.id === id ? null : cur));
    }, TOAST_DURATION_MS);
  }, []);

  const confirm = useCallback((title: string, body: string) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ title, body, resolve });
    });
  }, []);

  const closeConfirm = useCallback(
    (value: boolean) => {
      setConfirmState((cur) => {
        if (cur) cur.resolve(value);
        return null;
      });
    },
    [],
  );

  const value = useMemo<UiContextValue>(() => ({ showToast, confirm }), [showToast, confirm]);

  return (
    <UiContext.Provider value={value}>
      {children}

      {confirmState && (
        <div className="modal-backdrop" role="presentation" onClick={() => closeConfirm(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fw-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="fw-modal-title">{confirmState.title}</h3>
            <p>{confirmState.body}</p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => closeConfirm(false)}>
                {t('action.cancel')}
              </button>
              <button type="button" className="btn danger" onClick={() => closeConfirm(true)}>
                {t('action.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast${toast.error ? ' error' : ''}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
    </UiContext.Provider>
  );
}
