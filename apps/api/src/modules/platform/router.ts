import {updateSubscriptionInput,SubscriptionConflict,SubscriptionRuleRejected} from '../licensing/input.js';
import { credentialsSchema } from '../../infrastructure/credentials.js';
import { Router } from 'express';
import { z } from 'zod';
import { readOpaqueCookie } from '../identity/security.js';
import type { PlatformAuth } from './auth.js';
import { ClientConflict, type PlatformClients } from './clients.js';
import { newClientSchema } from './client-input.js';
const credentials = credentialsSchema;
const newClient = newClientSchema;
export function createPlatformRouter(auth: PlatformAuth, clients: PlatformClients, origin: string, secure: boolean) {
  const router = Router();
  const cookie = { httpOnly: true, secure, sameSite: 'strict' as const, path: '/api/v1/taggmaster' };
  const attempts = new Map<string, { count: number; until: number }>();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin') !== origin) {
      res.status(403).json({ code: 'ORIGIN_REJECTED' }); return;
    }
    next();
  });
  router.post('/login', async (req, res) => {
    const now = Date.now();
    for (const [key, attempt] of attempts) if (attempt.until <= now) attempts.delete(key);
    const ip = req.ip ?? 'unknown';
    const attempt = attempts.get(ip) ?? { count: 0, until: now + 15 * 60 * 1000 };
    if (attempt.count >= 10 || (!attempts.has(ip) && attempts.size >= 10000)) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((attempt.until - now) / 1000))));
      res.status(429).json({ code: 'TOO_MANY_ATTEMPTS' }); return;
    }
    attempt.count++; attempts.set(ip, attempt);
    const input = credentials.safeParse(req.body);
    if (!input.success) { res.status(400).json({ code: 'INVALID_INPUT' }); return; }
    const result = await auth.login(input.data.email, input.data.password);
    if (!result) { res.status(401).json({ code: 'INVALID_CREDENTIALS' }); return; }
    res.cookie('nf_master_session', result.token, { ...cookie, maxAge: result.maxAge }).json({ admin: result.admin });
  });
  router.post('/logout', async (req, res) => {
    const token = readOpaqueCookie(req.headers.cookie, 'nf_master_session');
    if (token) await auth.logout(token);
    res.clearCookie('nf_master_session', cookie).status(204).end();
  });
  // Only the separate platform session can pass this boundary.
  router.use(async (req, res, next) => {
    const token = readOpaqueCookie(req.headers.cookie, 'nf_master_session');
    const admin = token ? await auth.authenticate(token) : null;
    if (!admin) {
      res.clearCookie('nf_master_session', cookie).status(401).json({ code: 'MASTER_AUTHENTICATION_REQUIRED' }); return;
    }
    res.locals.platformAdmin = admin;
    next();
  });
  router.get('/session', (_req, res) => { res.json({ admin: res.locals.platformAdmin }); });
  router.get('/clients', async (req, res) => {
    const input = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), search: z.string().trim().max(80).default('') }).strict().safeParse(req.query);
    if (!input.success) { res.status(400).json({ code: 'INVALID_INPUT' }); return; }
    res.json(await clients.list(input.data));
  });
  router.post('/clients', async (req, res) => {
    const input = newClient.safeParse(req.body);
    if (!input.success) { res.status(400).json({ code: 'INVALID_INPUT', fields: input.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })) }); return; }
    try {
      const client = await clients.create(input.data, res.locals.platformAdmin.id);
      res.status(201).json({ client });
    } catch (error) {
      if (error instanceof ClientConflict) { res.status(409).json({ code: 'CLIENT_ALREADY_EXISTS' }); return; }
      throw error;
    }
  });
  router.patch('/clients/:id/subscription',async(req,res)=>{
    const id=z.string().regex(/^[a-f0-9]{24}$/i).safeParse(req.params.id),input=updateSubscriptionInput.safeParse(req.body);
    if(!id.success||!input.success){res.status(400).json({code:'INVALID_INPUT'});return;}
    try{const client=await clients.setSubscription(id.data,input.data,res.locals.platformAdmin.id);if(!client){res.status(404).json({code:'CLIENT_NOT_FOUND'});return;}res.json({client});}
    catch(error){if(error instanceof SubscriptionConflict){res.status(409).json({code:'SUBSCRIPTION_CONFLICT'});return;}if(error instanceof SubscriptionRuleRejected){res.status(400).json({code:'SUBSCRIPTION_RULE_REJECTED'});return;}throw error;}
  });
  router.patch('/clients/:id/status', async (req, res) => {
    const id = z.string().regex(/^[a-f0-9]{24}$/i).safeParse(req.params.id);
    const input = z.object({ active: z.boolean() }).strict().safeParse(req.body);
    if (!id.success || !input.success) { res.status(400).json({ code: 'INVALID_INPUT' }); return; }
    const client = await clients.setActive(id.data, input.data.active, res.locals.platformAdmin.id);
    if (!client) { res.status(404).json({ code: 'CLIENT_NOT_FOUND' }); return; }
    res.json({ client });
  });
  return router;
}
