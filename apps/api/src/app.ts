import {createOfflineRouter} from './modules/offline/router.js';
import {SubscriptionExpired} from './modules/licensing/input.js';
import {createFieldVisitRouter} from './modules/field-visits/router.js';
import {createTerritoryRouter} from './modules/territories/router.js';
import {createAgendaRouter} from './modules/agenda/router.js';
import {createOpportunityRouter} from './modules/opportunities/router.js';
import { AccountRestricted } from './infrastructure/account-gate.js';
import { createAccountSecurityRouter } from './modules/account-security/router.js';
import type { RecoveryMailer } from './modules/account-security/mail.js';
import { createRelationshipRouter } from './modules/relationships/router.js';
import { createAdministrationRouter } from './modules/administration/router.js';
import { rejectUnsafeInputKeys } from './infrastructure/request-security.js';
import express from 'express';
import { createPlatformRouter } from './modules/platform/router.js';
import type { PlatformAuth } from './modules/platform/auth.js';
import type { PlatformClients } from './modules/platform/clients.js';
import cors from 'cors';
import helmet from 'helmet';
import type { IdentityService } from './modules/identity/service.js';
import { createIdentityRouter } from './modules/identity/router.js';
export function createApp(options: { origin: string; databaseReady: () => boolean; identity?: IdentityService; platform?: { auth: PlatformAuth; clients: PlatformClients }; secureCookies?: boolean; recoveryMailer?: RecoveryMailer; privacyContact?: string }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: options.origin, credentials: true }));
  app.use('/api', (_req, res, next) => { res.set('Cache-Control','no-store'); next(); });
  app.use(express.json({ limit: '256kb' }));
  app.use('/api', rejectUnsafeInputKeys);
  app.get('/api/v1/health/live', (_req, res) => { res.json({ status: 'ok', service: 'nexforge-crm' }); });
  app.get('/api/v1/health/ready', (_req, res) => {
    const ready = options.databaseReady();
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'unavailable' });
  });
  if (options.identity) {
    app.use('/api/v1/auth', createIdentityRouter(options.identity, options.origin, options.secureCookies ?? false));
    app.use('/api/v1/auth',createAccountSecurityRouter(options.identity,options.origin,options.recoveryMailer,options.privacyContact));
    app.use('/api/v1/companies/:companyId/crm',createRelationshipRouter(options.identity,options.origin));
    app.use('/api/v1/companies/:companyId/opportunities',createOpportunityRouter(options.identity,options.origin));
    app.use('/api/v1/companies/:companyId/field-visits',createFieldVisitRouter(options.identity,options.origin));
    app.use('/api/v1/companies/:companyId/offline',createOfflineRouter(options.identity,options.origin));
    app.use('/api/v1/companies/:companyId/agenda',createAgendaRouter(options.identity,options.origin));
    app.use('/api/v1/companies/:companyId/territories',createTerritoryRouter(options.identity,options.origin));
    app.use('/api/v1/admin', createAdministrationRouter(options.identity,options.origin));
  }
  if (options.platform) app.use('/api/v1/taggmaster', createPlatformRouter(options.platform.auth, options.platform.clients, options.origin, options.secureCookies ?? false));
  // Commercial endpoints stay closed until their own authorization and persistence are tested.
  app.use('/api/v1', (_req, res) => { res.set('Cache-Control', 'no-store').status(401).json({ code: 'AUTHENTICATION_REQUIRED' }); });
  app.use((_req, res) => { res.status(404).json({ code: 'NOT_FOUND' }); });
  app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if(error instanceof SubscriptionExpired){res.status(403).json({code:'TRIAL_EXPIRED'});return;}
    if(error instanceof AccountRestricted){res.status(403).json({code:error.code});return;}
    const status = error.status === 413 ? 413 : error.status === 400 ? 400 : 500;
    res.status(status).json({ code: status === 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST' });
  });
  return app;
}

