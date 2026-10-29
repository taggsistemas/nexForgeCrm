import { createDefaultProfiles } from '../identity/default-profiles.js';
import mongoose from 'mongoose';
import { Company, Membership, Role, Session, Tenant, User } from '../identity/models.js';
import { hashPassword } from '../identity/security.js';
import { PlatformAudit } from './models.js';
import { newClientSchema, type NewClientInput } from './client-input.js';
import type { CustomerRegistration } from '../../../../../packages/contracts/src/customer.js';
export type NewClient = NewClientInput;
export interface ClientView {
  registration?: CustomerRegistration;
  id: string;
  name: string;
  slug: string;
  active: boolean;
  companyName: string;
  admin: { name: string; email: string } | null;
  createdAt: string;
}
export class ClientConflict extends Error {}
export async function initializeClientModels() {
  // Indexes/collections must exist before creating documents in a transaction.
  await Promise.all([User.init(), Tenant.init(), Company.init(), Role.init(), Membership.init(), Session.init(), PlatformAudit.init()]);
}
export const platformClients = {
  async create(input: NewClient, adminId: string): Promise<ClientView> {
    input = newClientSchema.parse(input);
    const registration = { taxId: input.taxId, stateRegistration: input.stateRegistration, contactName: input.contactName, contactEmail: input.contactEmail, phone: input.phone, address: input.address, contract: input.contract };
    const passwordHash = await hashPassword(input.adminPassword);
    try {
      return await mongoose.connection.transaction(async session => {
        if (await User.exists({ email: input.adminEmail }).session(session)) throw new ClientConflict();
        const [user] = await User.create([{ name: input.adminName, email: input.adminEmail, passwordHash,mustChangePassword:true }], { session });
        const [tenant] = await Tenant.create([{ name: input.name, slug: input.slug, primaryAdminId: user._id, registration }], { session });
        const [company] = await Company.create([{ tenantId: tenant._id, name: input.companyName }], { session });
        const [role] = await createDefaultProfiles(tenant._id,session);
        await Membership.create([{ userId: user._id, tenantId: tenant._id, companyIds: [company._id], roleIds: [role._id] }], { session });
        await PlatformAudit.create([{ adminId, tenantId: tenant._id, action: 'client.created' }], { session });
        return { id: String(tenant._id), name: tenant.name, slug: tenant.slug, active: tenant.active,
          registration, companyName: company.name, admin: { name: user.name, email: user.email }, createdAt: tenant.createdAt.toISOString() };
      });
    } catch (error) {
      if (error instanceof ClientConflict || (error as { code?: number }).code === 11000) throw new ClientConflict();
      throw error;
    }
  },
  async list(input: { page: number; search: string }) {
    const literal = input.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = literal ? { $or: [{ name: { $regex: literal, $options: 'i' } }, { slug: { $regex: literal, $options: 'i' } }] } : {};
    const [tenants, total] = await Promise.all([
      Tenant.find(filter).sort({ createdAt: -1, _id: -1 }).skip((input.page - 1) * 20).limit(20),
      Tenant.countDocuments(filter),
    ]);
    const items = await Promise.all(tenants.map(async tenant => {
      const [company, membership] = await Promise.all([
        Company.findOne({ tenantId: tenant._id }).sort({ _id: 1 }),
        tenant.primaryAdminId ? null : Membership.findOne({ tenantId: tenant._id, active: true }).sort({ createdAt: 1 }),
      ]);
      const user = await User.findById(tenant.primaryAdminId ?? membership?.userId).select('name email');
      return { id: String(tenant._id), name: tenant.name, slug: tenant.slug, active: tenant.active,
        registration: tenant.toObject().registration as CustomerRegistration | undefined,
        companyName: company?.name ?? '', admin: user ? { name: user.name, email: user.email } : null,
        createdAt: tenant.createdAt.toISOString() };
    }));
    return { items, total, page: input.page, pageSize: 20 };
  },
  async setActive(tenantId: string, active: boolean, adminId: string) {
    return mongoose.connection.transaction(async session => {
      const tenant = await Tenant.findOneAndUpdate({ _id: tenantId }, { active }, { new: true, session });
      if (!tenant) return null;
      if (!active) await Session.deleteMany({ tenantId: tenant._id }, { session });
      await PlatformAudit.create([{ adminId, tenantId: tenant._id, action: active ? 'client.activated' : 'client.suspended' }], { session });
      return { id: String(tenant._id), active: tenant.active };
    });
  },
};
export type PlatformClients = typeof platformClients;
