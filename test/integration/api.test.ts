import request from 'supertest';
import type { Express } from 'express';
import { openDb } from '../../src/lib/db';
import { bindDevice } from '../../src/lib/device';
import { ResetGate } from '../../src/lib/domain/dailyReset';
import { buildApp } from '../../src/server/app';

function makeApp(nowIso = '2026-07-07T04:00:00Z'): { app: Express; resetGate: ResetGate } {
  const db = openDb({ filename: ':memory:' });
  const device = bindDevice({ FW_ESP32_MODE: 'virtual' } as NodeJS.ProcessEnv);
  const resetGate = new ResetGate();
  const app = buildApp({ db, device, resetGate, now: () => new Date(nowIso) });
  return { app, resetGate };
}

describe('API 統合(セッション所有・ハニーポット・F1〜F4)', () => {
  it('OCR登録 → 一覧に賞味期限つきで反映される', async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    const res = await agent.post('/api/items').send({ ocrText: '明治牛乳 消費期限 2026.07.10' });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].expiryDate).toBe('2026-07-10');
    expect(res.body.items[0].categoryName).toBe('乳製品');
    expect(res.body.alert.levelKey).toBe('warning'); // 残3日
  });

  it('セッションを跨いだデータは見えない(所有分離)', async () => {
    const { app } = makeApp();
    const a = request.agent(app);
    const b = request.agent(app);
    await a.post('/api/items').send({ ocrText: 'りんご 2026.09.01' });
    const bState = await b.get('/api/state');
    expect(bState.body.items).toHaveLength(0); // 別セッションには見えない
  });

  it('他セッションの食材IDは補正/削除できない(404)', async () => {
    const { app } = makeApp();
    const a = request.agent(app);
    const b = request.agent(app);
    const reg = await a.post('/api/items').send({ ocrText: 'トマト 2026.09.01' });
    const id = reg.body.items[0].id;
    const adj = await b.post(`/api/items/${id}/adjust`).send({ percent: 10 });
    expect(adj.status).toBe(404);
    const del = await b.delete(`/api/items/${id}`);
    expect(del.status).toBe(404);
  });

  it('ハニーポット項目に入力があれば破棄(登録されない)', async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    const res = await agent
      .post('/api/items')
      .send({ ocrText: 'ボット投稿 2026.09.01', website: 'http://spam.example' });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });

  it('OCR完全失敗(空テキスト)は手動フォールバックを促す', async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    const res = await agent.post('/api/items').send({ ocrText: '   ' });
    expect(res.body.needManual).toBe(true);
  });

  it('手動登録 → 残量補正で残量が更新される', async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    const reg = await agent
      .post('/api/items/manual')
      .send({ name: '手動野菜', categoryId: 4, expiryDate: '2026-07-20' });
    const id = reg.body.items[0].id;
    const adj = await agent.post(`/api/items/${id}/adjust`).send({ percent: 15 });
    expect(adj.status).toBe(200);
    expect(adj.body.items[0].remainPercent).toBe(15);
    expect(adj.body.items[0].restock).toBe(true);
  });

  it('危険食材でファン作動・仮想デバイスが赤LEDになる', async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    const res = await agent.post('/api/items').send({ ocrText: '期限切れ 2026-07-01' });
    expect(res.body.alert.levelKey).toBe('danger');
    expect(res.body.alert.fanActivated).toBe(true);
    const dev = await agent.get('/api/device');
    expect(dev.body.state.command).toBe('LED_RED_FAN');
  });

  it('日次リセット中は 503 リセット中を返す', async () => {
    const { app, resetGate } = makeApp();
    const agent = request.agent(app);
    // リセット実行中を模擬(ResetGate をリフレクションではなくフラグ実行で再現)。
    const gateAny = resetGate as unknown as { resetting: boolean };
    gateAny.resetting = true;
    const res = await agent.get('/api/state');
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('resetting');
  });

  it('POST /api/reset は自セッションのみ削除し、他セッションは残す', async () => {
    const { app } = makeApp();
    const a = request.agent(app);
    const b = request.agent(app);
    await a.post('/api/items').send({ ocrText: 'キャベツ 2026.09.01' });
    await b.post('/api/items').send({ ocrText: 'トマト 2026.09.01' });

    const reset = await a.post('/api/reset');
    expect(reset.body.ok).toBe(true);
    const aState = await a.get('/api/state');
    expect(aState.body.items).toHaveLength(0); // 自分は消える

    const bState = await b.get('/api/state');
    expect(bState.body.items).toHaveLength(1); // 他人は残る
  });
});
