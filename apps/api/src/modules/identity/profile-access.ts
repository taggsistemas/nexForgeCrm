import { assertAccountReady } from '../../infrastructure/account-gate.js';
import type { AccessContext, Permission } from '../../../../../packages/contracts/src/index.js';
import { profileDefinitions, type ProfileKey } from '../../../../../packages/contracts/src/profiles.js';
import { AccessDenied, scopedFilter } from '../../infrastructure/access.js';
export function profileVisibility(keys: readonly ProfileKey[]) {
  const modes=keys.map(key=>profileDefinitions[key].visibility);
  return modes.includes('company') ? 'company' : modes.includes('team') ? 'team' : 'own';
}
// Only validated server-side AccessContext may enter this function.
// Commercial models using this filter must store ownerId (User) consistently.
export function commercialFilter(context: AccessContext, companyId:string, permission:Permission, filter:Record<string,unknown>={}) {
  assertAccountReady(context);
  if (!context.dataAccess) throw new AccessDenied();
  const scoped=scopedFilter(context,companyId,permission,filter);
  if(context.dataAccess.visibility==='company') return scoped;
  const owners=context.dataAccess.visibility==='own'?[context.userId]:[context.userId,...context.dataAccess.supervisedUserIds];
  return {$and:[...scoped.$and,{ownerId:{$in:[...new Set(owners)]}}]};
}
