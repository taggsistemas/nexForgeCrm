import { replaceSingleSession } from '../identity/single-session.js';
import { credentialsSchema } from '../../infrastructure/credentials.js';
import { PlatformAdmin, PlatformSession } from './models.js';
import { hashPassword, newSessionToken, tokenHash, verifyPassword } from '../identity/security.js';
const lifetime = 2 * 60 * 60 * 1000;
let dummyHash: Promise<string> | undefined;
export interface MasterAdminView { id: string; name: string; email: string }
export const platformAuth = {
  async login(email: string, password: string) {
    const input = credentialsSchema.safeParse({ email, password });
    if (!input.success) return null;
    email = input.data.email; password = input.data.password;
    const admin = await PlatformAdmin.findOne({ email, active: true }).select('+passwordHash');
    dummyHash ??= hashPassword(newSessionToken());
    const valid = await verifyPassword(password, admin?.passwordHash ?? await dummyHash);
    if (!admin || !valid) return null;
    const token = newSessionToken();
    await replaceSingleSession(async () => PlatformSession.findOneAndUpdate({ _id: admin._id }, { $set: { adminId: admin._id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + lifetime) } }, { upsert: true, new: true, runValidators: true }));
    return { token, maxAge: lifetime, admin: { id: String(admin._id), name: admin.name, email: admin.email } };
  },
  async authenticate(token: string): Promise<MasterAdminView | null> {
    const session = await PlatformSession.findOne({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } });
    if (!session || String(session._id) !== String(session.adminId)) return null;
    const admin = await PlatformAdmin.findOne({ _id: session.adminId, active: true });
    if (!admin || !await PlatformSession.exists({ _id: session._id, tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } })) return null;
    return admin ? { id: String(admin._id), name: admin.name, email: admin.email } : null;
  },
  async logout(token: string) { await PlatformSession.deleteOne({ tokenHash: tokenHash(token) }); },
};
export type PlatformAuth = typeof platformAuth;
