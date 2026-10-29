import { assertAccountReady } from './account-gate.js';
import type { RequestHandler } from 'express';
import type { AccessContext, Permission } from '../../../../packages/contracts/src/index.js';
import type { IdentityService } from '../modules/identity/service.js';
import { readSessionCookie } from '../modules/identity/security.js';
import { companyScope } from './access.js';
export interface AuthorizedCompany {
  context: AccessContext;
  scope: { tenantId: string; companyId: string };
}
// Future business routers use a :companyId parameter plus strict request DTOs.
// Tenant/user/roles supplied by the caller never create an authenticated context.
export function authorizeCompany(identity: IdentityService, permission: Permission): RequestHandler {
  return async (req, res, next) => {
    res.set('Cache-Control','no-store');
    const token = readSessionCookie(req.headers.cookie);
    const verified = token ? await identity.authenticate(token) : null;
    if (!verified) { res.status(401).json({ code:'AUTHENTICATION_REQUIRED' }); return; }
    assertAccountReady(verified.context);
    const companyId = req.params.companyId;
    if (typeof companyId !== 'string' || !/^[a-f0-9]{24}$/i.test(companyId)) {
      res.status(400).json({ code:'INVALID_REQUEST' }); return;
    }
    const normalizedId = companyId.toLowerCase();
    try {
      const scope = companyScope(verified.context, normalizedId, permission);
      const context = Object.freeze({
        ...verified.context,onboarding:verified.context.onboarding?Object.freeze({...verified.context.onboarding}):undefined, companyIds: Object.freeze([...verified.context.companyIds]),
        permissions: Object.freeze([...verified.context.permissions]),
        dataAccess: verified.context.dataAccess ? Object.freeze({ ...verified.context.dataAccess, supervisedUserIds: Object.freeze([...verified.context.dataAccess.supervisedUserIds]) }) : undefined,
      });
      res.locals.authorizedCompany = Object.freeze({ context, scope: Object.freeze(scope) }) satisfies AuthorizedCompany;
    } catch {
      // Do not reveal whether another tenant's company exists.
      res.status(403).json({ code:'ACCESS_DENIED' }); return;
    }
    next();
  };
}
