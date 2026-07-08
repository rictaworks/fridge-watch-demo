/**
 * API クライアント。fetch を薄くラップし、例外を握りつぶさず ApiResult に正規化する。
 * ベース URL は config に集約(ハードコード禁止)。テストでは global.fetch を差し替えてモックする。
 */
import { API_BASE_URL } from './config';
import type { ApiResult, FridgeView, MastersResponse, NeedManualResponse } from './types';

function url(path: string): string {
  return `${API_BASE_URL}${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(url(path), {
    credentials: 'include',
    ...init,
  });
  let body: T | null = null;
  try {
    body = (await res.json()) as T;
  } catch {
    // JSON でない応答(204 等)は body=null のまま。フォールバックせず ok/status で判断させる。
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}

export interface RegisterInput {
  /** パッケージ写真(F1 手順1)。任意(テキスト貼り付けのみの利用も許容)。 */
  photo: File | null;
  /** OCR 相当のパッケージ文字。デモでは写真の代替として利用可。 */
  ocrText: string;
  name: string;
  /** ハニーポット(不可視)。入力があればサーバ側で破棄される。 */
  website: string;
}

export interface ManualInput {
  categoryId: number;
  expiryDate: string;
  name: string;
  website: string;
}

export const api = {
  getMasters(): Promise<ApiResult<MastersResponse>> {
    return request<MastersResponse>('/api/masters');
  },

  getState(): Promise<ApiResult<FridgeView>> {
    return request<FridgeView>('/api/state');
  },

  /**
   * 食材登録(設計 F1)。写真を含めて multipart/form-data で送信する。
   * Content-Type はブラウザが境界付きで自動設定するため明示しない。
   */
  registerItem(input: RegisterInput): Promise<ApiResult<FridgeView | NeedManualResponse>> {
    const form = new FormData();
    if (input.photo) form.append('image', input.photo);
    form.append('ocrText', input.ocrText);
    form.append('name', input.name);
    form.append('website', input.website);
    return request<FridgeView | NeedManualResponse>('/api/items', {
      method: 'POST',
      body: form,
    });
  },

  registerManual(input: ManualInput): Promise<ApiResult<FridgeView>> {
    return request<FridgeView>('/api/items/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  },

  adjustItem(id: number, percent: number): Promise<ApiResult<FridgeView>> {
    return request<FridgeView>(`/api/items/${id}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percent }),
    });
  },

  deleteItem(id: number): Promise<ApiResult<FridgeView>> {
    return request<FridgeView>(`/api/items/${id}`, { method: 'DELETE' });
  },

  reset(): Promise<ApiResult<FridgeView & { ok: boolean; deleted: unknown }>> {
    return request('/api/reset', { method: 'POST' });
  },
};

/** HTTP ステータスから i18n メッセージキーへ写像する(フォールバックせず明示分岐)。 */
export function errorMessageKey(status: number): string {
  switch (status) {
    case 503:
      return 'error.resetting';
    case 404:
      return 'error.notFound';
    case 400:
      return 'error.invalid';
    default:
      return 'error.generic';
  }
}
