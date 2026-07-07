/**
 * HTTP API(Express)。デモ版方針: 認証なし・セッションID所有分離・ハニーポットBot対策。
 * ルート/日次リセット中は 503「リセット中」を返す。フォールバックで握りつぶさない。
 */
import express, { type Request, type Response, type NextFunction } from 'express';
import * as path from 'path';
import type { Database as DB } from 'better-sqlite3';
import { SessionManager } from '../lib/session';
import { FridgeService } from '../lib/service';
import { ResetGate, isResetWindow } from '../lib/domain/dailyReset';
import type { DeviceBinding } from '../lib/device';
import { categories } from '../lib/masters';
import { config } from '../lib/masters';

export interface AppDeps {
  db: DB;
  device: DeviceBinding;
  resetGate: ResetGate;
  /** 現在時刻プロバイダ(テスト差し替え可)。 */
  now?: () => Date;
}

const HONEYPOT_FIELD = 'website';

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

/** ハニーポット項目に入力があれば true(Bot とみなし破棄)。 */
function isHoneypotTriggered(body: Record<string, unknown>): boolean {
  const v = body[HONEYPOT_FIELD];
  return typeof v === 'string' && v.trim().length > 0;
}

export function buildApp(deps: AppDeps): express.Express {
  const { db, device, resetGate } = deps;
  const now = deps.now ?? (() => new Date());
  const sessions = new SessionManager(db);
  const service = new FridgeService(db, device.transport);

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  // 日次リセット中は全 API を 503 で応答する。
  app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
    if (resetGate.isResetting() || isResetWindow(now())) {
      res.status(503).json({ error: 'resetting', message_key: 'error.resetting' });
      return;
    }
    next();
  });

  // セッション確保(なければ発行しCookieをSet)。全 /api で有効。
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const cookies = parseCookies(req.headers.cookie);
    const sid = sessions.ensure(cookies[config.session.cookieName], now());
    res.locals.sessionId = sid;
    res.cookie(config.session.cookieName, sid, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    });
    next();
  });

  const sid = (res: Response): string => res.locals.sessionId as string;

  app.get('/api/masters', (_req: Request, res: Response) => {
    res.json({ categories, locales: config.i18n.locales, rtlLocales: config.i18n.rtlLocales });
  });

  app.get('/api/device', (_req: Request, res: Response) => {
    res.json({ mode: device.mode, state: device.virtual ? device.virtual.snapshot() : null });
  });

  app.get('/api/state', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await service.view(sid(res), now()));
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/items', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (isHoneypotTriggered(req.body)) {
        // Bot とみなし破棄。登録せず現状ビューを返す(攻撃者に成否を悟らせない)。
        res.json(await service.view(sid(res), now()));
        return;
      }
      const result = await service.registerFromOcr(
        sid(res),
        { name: req.body.name ?? null, ocrText: String(req.body.ocrText ?? '') },
        now(),
      );
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/items/manual', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (isHoneypotTriggered(req.body)) {
        res.json(await service.view(sid(res), now()));
        return;
      }
      const categoryId = Number(req.body.categoryId);
      const expiryDate = String(req.body.expiryDate ?? '');
      if (!Number.isInteger(categoryId) || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
        res.status(400).json({ error: 'invalid_input', message_key: 'error.invalid_input' });
        return;
      }
      const view = await service.registerManual(
        sid(res),
        { name: req.body.name ?? null, categoryId, expiryDate },
        now(),
      );
      res.json(view);
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/items/:id/adjust', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const percent = Number(req.body.percent);
      if (!Number.isInteger(id) || !Number.isFinite(percent)) {
        res.status(400).json({ error: 'invalid_input', message_key: 'error.invalid_input' });
        return;
      }
      const view = await service.adjust(sid(res), id, percent, now());
      if (!view) {
        res.status(404).json({ error: 'not_found', message_key: 'error.not_found' });
        return;
      }
      res.json(view);
    } catch (e) {
      next(e);
    }
  });

  app.delete('/api/items/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'invalid_input', message_key: 'error.invalid_input' });
        return;
      }
      const view = await service.remove(sid(res), id, now());
      if (!view) {
        res.status(404).json({ error: 'not_found', message_key: 'error.not_found' });
        return;
      }
      res.json(view);
    } catch (e) {
      next(e);
    }
  });

  // 手動リセットは自セッションのデータのみ削除する(他来場者のデモを消さない)。
  // 全セッションの全削除は F4 スケジューラ(JST 03:00)のみが行う。
  app.post('/api/reset', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { view, deleted } = await service.clearOwn(sid(res), now());
      res.json({ ok: true, deleted, ...view });
    } catch (e) {
      next(e);
    }
  });

  // 静的 UI。
  app.use(express.static(path.join(__dirname, '..', 'web')));

  // エラーハンドラ(握りつぶさず 500 + トレース可能なログ)。
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    process.stderr.write(`[error] ${err.stack ?? err.message}\n`);
    res.status(500).json({ error: 'internal', message_key: 'error.internal' });
  });

  return app;
}
