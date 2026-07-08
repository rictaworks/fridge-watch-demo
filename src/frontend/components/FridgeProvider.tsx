'use client';

/**
 * 冷蔵庫の状態(食材一覧・アラート・カテゴリマスタ)を保持し、API 操作を配布する。
 * 例外は握りつぶさず、失敗時はトーストで利用者に通知する(フォールバック禁止)。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslations } from 'next-intl';
import { api, errorMessageKey, type ManualInput, type RegisterInput } from '@/lib/api';
import { isNeedManual, type Category, type FridgeView } from '@/lib/types';
import { useUi } from './UiProvider';

interface FridgeContextValue {
  view: FridgeView | null;
  categories: Category[];
  ready: boolean;
  register: (input: RegisterInput) => Promise<'ok' | 'need-manual' | 'error'>;
  registerManual: (input: ManualInput) => Promise<boolean>;
  adjust: (id: number, percent: number) => Promise<void>;
  remove: (id: number) => Promise<void>;
  reset: () => Promise<void>;
}

const FridgeContext = createContext<FridgeContextValue | null>(null);

export function useFridge(): FridgeContextValue {
  const ctx = useContext(FridgeContext);
  if (!ctx) {
    throw new Error('useFridge must be used within FridgeProvider');
  }
  return ctx;
}

export function FridgeProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const { showToast } = useUi();
  const [view, setView] = useState<FridgeView | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ready, setReady] = useState(false);

  const notifyError = useCallback(
    (status: number) => {
      showToast(t(errorMessageKey(status)), true);
    },
    [showToast, t],
  );

  const refresh = useCallback(async () => {
    const res = await api.getState();
    if (res.ok && res.body) {
      setView(res.body);
    } else {
      notifyError(res.status);
    }
  }, [notifyError]);

  useEffect(() => {
    let active = true;
    (async () => {
      const masters = await api.getMasters();
      if (active && masters.ok && masters.body) {
        setCategories(masters.body.categories);
      }
      const state = await api.getState();
      if (active && state.ok && state.body) {
        setView(state.body);
      }
      if (active) setReady(true);
    })().catch((err: unknown) => {
      // 初期化失敗も握りつぶさず通知する。
      if (process.env.NODE_ENV !== 'production') {
        console.error('[fridge] init failed', err);
      }
      if (active) {
        setReady(true);
        showToast(t('error.generic'), true);
      }
    });
    return () => {
      active = false;
    };
  }, [showToast, t]);

  const register = useCallback<FridgeContextValue['register']>(
    async (input) => {
      const res = await api.registerItem(input);
      if (!res.ok) {
        notifyError(res.status);
        return 'error';
      }
      if (isNeedManual(res.body)) {
        showToast(t('toast.needManual'), true);
        return 'need-manual';
      }
      if (res.body) setView(res.body);
      showToast(t('toast.registered'));
      return 'ok';
    },
    [notifyError, showToast, t],
  );

  const registerManual = useCallback<FridgeContextValue['registerManual']>(
    async (input) => {
      const res = await api.registerManual(input);
      if (res.ok && res.body) {
        setView(res.body);
        showToast(t('toast.registered'));
        return true;
      }
      notifyError(res.status);
      return false;
    },
    [notifyError, showToast, t],
  );

  const adjust = useCallback<FridgeContextValue['adjust']>(
    async (id, percent) => {
      const res = await api.adjustItem(id, percent);
      if (res.ok && res.body) {
        setView(res.body);
        showToast(t('toast.adjusted'));
      } else {
        notifyError(res.status);
      }
    },
    [notifyError, showToast, t],
  );

  const remove = useCallback<FridgeContextValue['remove']>(
    async (id) => {
      const res = await api.deleteItem(id);
      if (res.ok && res.body) {
        setView(res.body);
        showToast(t('toast.deleted'));
      } else {
        notifyError(res.status);
      }
    },
    [notifyError, showToast, t],
  );

  const reset = useCallback<FridgeContextValue['reset']>(async () => {
    const res = await api.reset();
    if (res.ok) {
      showToast(t('toast.reset'));
      await refresh();
    } else {
      notifyError(res.status);
    }
  }, [notifyError, refresh, showToast, t]);

  const value = useMemo<FridgeContextValue>(
    () => ({ view, categories, ready, register, registerManual, adjust, remove, reset }),
    [view, categories, ready, register, registerManual, adjust, remove, reset],
  );

  return <FridgeContext.Provider value={value}>{children}</FridgeContext.Provider>;
}
