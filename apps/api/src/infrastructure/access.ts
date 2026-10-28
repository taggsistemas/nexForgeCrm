import type { AccessContext, Permission } from '../../../../packages/contracts/src/index.js';
export class AccessDenied extends Error {
  constructor() { super('Acesso não autorizado.'); }
}
// Only a verified server-side session and membership may produce this context.
export function companyScope(context: AccessContext, companyId: string, permission: Permission) {
  if (!context.userId || !context.tenantId || !context.companyIds.includes(companyId) || !context.permissions.includes(permission)) throw new AccessDenied();
  return { tenantId: context.tenantId, companyId };
}
export function scopedFilter(context: AccessContext, companyId: string, permission: Permission, filter: Record<string, unknown> = {}) {
  return { $and: [companyScope(context, companyId, permission), filter] };
}