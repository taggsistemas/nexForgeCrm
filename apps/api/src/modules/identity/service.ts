import {subscriptionExpired} from '../licensing/service.js';
import {SubscriptionExpired} from '../licensing/input.js';
import { privacyVersion } from '../../../../../packages/contracts/src/privacy.js';
import { permissions as allPermissions } from '../../../../../packages/contracts/src/index.js';
import { profileDefinitions, type ProfileKey } from '../../../../../packages/contracts/src/profiles.js';
import { profileVisibility } from './profile-access.js';
import { replaceSingleSession } from './single-session.js';
import { credentialsSchema } from '../../infrastructure/credentials.js';
import type { AccessContext, Permission } from '../../../../../packages/contracts/src/index.js';
import { Company, Membership, Role, Session, Tenant, User } from './models.js';
import { hashPassword, newSessionToken, tokenHash, verifyPassword } from './security.js';
const lifetime = 8 * 60 * 60 * 1000;
let dummyHash: Promise<string> | undefined;
export interface SessionView {
  security:{mustChangePassword:boolean;privacyAcceptanceRequired:boolean};
  user: { id: string; name: string; email: string };
  tenant: { id: string; name: string; slug: string };
  companies: { id: string; name: string }[];
  permissions: Permission[];
  profiles: {key: string | null; name:string}[];
}
export interface VerifiedSession { view: SessionView; context: AccessContext; credentialVersion:number }
async function resolveAccess(userId: string, tenantId: string): Promise<VerifiedSession | null> {
  const [user, tenant, membership] = await Promise.all([
    User.findOne({ _id: userId, active: true }),
    Tenant.findOne({ _id: tenantId, active: true }),
    Membership.findOne({ userId, tenantId, active: true }),
  ]);
  if (!user || !tenant || !membership || subscriptionExpired(tenant)) return null;
  // Scope every referenced role/company to the verified tenant, even if stored IDs are corrupt.
  const [companies, roles] = await Promise.all([
    Company.find({ _id: { $in: membership.companyIds }, tenantId, active: true }).sort({ _id: 1 }),
    Role.find({ _id: { $in: membership.roleIds }, tenantId }),
  ]);
  if (!companies.length || !roles.length) return null;
  const owner = String(tenant.primaryAdminId) === String(user._id); const granted = owner ? [...allPermissions] : [...new Set(roles.flatMap(role => role.key ? profileDefinitions[role.key].permissions : role.permissions))] as Permission[];
  const keys=roles.flatMap(role=>role.key?[role.key as ProfileKey]:[]);
  const visibility=String(tenant.primaryAdminId)===String(user._id) ? 'company' : profileVisibility(keys);
  const sellerRoles=visibility==='team' ? await Role.find({tenantId:tenant._id,key:'seller'}).select('_id') : [];
  const supervised=visibility==='team' ? await Membership.find({tenantId:tenant._id,active:true,userId:{$in:membership.supervisedUserIds},roleIds:{$in:sellerRoles.map(role=>role._id)}}).select('userId') : [];
  const activeSellers=supervised.length ? await User.find({_id:{$in:supervised.map(item=>item.userId)},active:true}).select('_id') : [];
  const dataAccess: NonNullable<AccessContext['dataAccess']>={visibility,supervisedUserIds:activeSellers.map(item=>String(item._id))};
  return {
    credentialVersion:user.passwordVersion,
    context: { onboarding:{passwordChangeRequired:user.mustChangePassword,privacyAcceptanceRequired:membership.privacyVersion!==privacyVersion},userId: String(user._id), tenantId: String(tenant._id), companyIds: companies.map(company => String(company._id)), permissions: granted, dataAccess },
    view: {
      security:{mustChangePassword:user.mustChangePassword,privacyAcceptanceRequired:membership.privacyVersion!==privacyVersion},
      user: { id: String(user._id), name: user.name, email: user.email },
      tenant: { id: String(tenant._id), name: tenant.name, slug: tenant.slug },
      companies: companies.map(company => ({ id: String(company._id), name: company.name })),
      permissions: granted,
      profiles: roles.map(role=>({key:role.key ?? null,name:role.key?profileDefinitions[role.key].name:role.name})),
    },
  };
}
export const identityService = {
  async login(email: string, password: string) {
    const input = credentialsSchema.safeParse({ email, password });
    if (!input.success) return null;
    email = input.data.email; password = input.data.password;
    const user = await User.findOne({ email, active: true }).select('+passwordHash');
    dummyHash ??= hashPassword(newSessionToken());
    const valid = await verifyPassword(password, user?.passwordHash ?? await dummyHash);
    if (!user || !valid) return null;
    const memberships = await Membership.find({ userId: user._id, active: true });
    const tenants = await Tenant.find({ _id: { $in: memberships.map(item => item.tenantId) }, active: true }).limit(2);
    // Never silently choose an organization when persisted access is ambiguous.
    if (tenants.length !== 1) return null;
    const tenant = tenants[0]!;if(subscriptionExpired(tenant))throw new SubscriptionExpired();

    const verified = await resolveAccess(String(user._id), String(tenant._id));
    if (!verified || verified.credentialVersion!==user.passwordVersion) return null;
    const token = newSessionToken();
    await replaceSingleSession(async () => Session.findOneAndUpdate({ _id: user._id }, { $set: { tokenHash: tokenHash(token),passwordVersion:user.passwordVersion, userId: user._id, tenantId: tenant._id, expiresAt: new Date(Date.now() + lifetime) } }, { upsert: true, new: true, runValidators: true }));
    return { token, maxAge: lifetime, ...verified };
  },
  async authenticate(token: string) {
    const session = await Session.findOne({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } });
    if (!session || String(session._id) !== String(session.userId)) return null;
    const access = await resolveAccess(String(session.userId), String(session.tenantId));
    if (!access || access.credentialVersion!==session.passwordVersion || !await Session.exists({ _id: session._id, tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } })) return null;
    return access;
  },
  async logout(token: string) { await Session.deleteOne({ tokenHash: tokenHash(token) }); },
};
export type IdentityService = typeof identityService;
