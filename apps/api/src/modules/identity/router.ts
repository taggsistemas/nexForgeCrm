import { credentialsSchema } from '../../infrastructure/credentials.js';
import { Router } from 'express';
import type { IdentityService } from './service.js';
import { readSessionCookie } from './security.js';
const credentials = credentialsSchema;
export function createIdentityRouter(service: IdentityService, origin: string, secure: boolean) {
  const router = Router();
  const attempts = new Map<string, { count: number; until: number }>();
  const cookie = { httpOnly: true, secure, sameSite: 'strict' as const, path: '/api/v1' };
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin') !== origin) {
      res.status(403).json({ code: 'ORIGIN_REJECTED' }); return;
    }
    next();
  });
  router.post('/login', async (req, res) => {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const ip = req.ip ?? 'unknown';
    const attempt = attempts.get(ip) ?? { count: 0, until: now + 15 * 60 * 1000 };
    if (attempt.count >= 10 || (!attempts.has(ip) && attempts.size >= 10000)) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((attempt.until - now) / 1000))));
      res.status(429).json({ code: 'TOO_MANY_ATTEMPTS' }); return;
    }
    attempt.count++; attempts.set(ip, attempt);
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ code: 'INVALID_CREDENTIALS_FORMAT' }); return; }
    const result = await service.login(parsed.data.email, parsed.data.password);
    if (!result) { res.status(401).json({ code: 'INVALID_CREDENTIALS' }); return; }
    res.cookie('nf_session', result.token, { ...cookie, maxAge: result.maxAge });
    res.json(result.view);
  });
  router.get('/session', async (req, res) => {
    const token = readSessionCookie(req.headers.cookie);
    const session = token ? await service.authenticate(token) : null;
    if (!session) {
      res.clearCookie('nf_session', cookie);
      res.status(401).json({ code: 'AUTHENTICATION_REQUIRED' }); return;
    }
    res.json(session.view);
  });
  router.post('/logout', async (req, res) => {
    const token = readSessionCookie(req.headers.cookie);
    if (token) await service.logout(token);
    res.clearCookie('nf_session', cookie);
    res.status(204).end();
  });
  return router;
}
