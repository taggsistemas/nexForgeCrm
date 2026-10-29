import type { ClientSession } from 'mongoose';
import { Role } from './models.js';
import { profileDefinitions, profileKeys } from '../../../../../packages/contracts/src/profiles.js';
export async function createDefaultProfiles(tenantId: unknown, session: ClientSession) {
  return Role.create(profileKeys.map(key=>({
    tenantId,key,name: key==='tenant_admin' ? 'Administrador' : profileDefinitions[key].name,
    permissions:[...profileDefinitions[key].permissions],
  })),{session,ordered:true});
}
