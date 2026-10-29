import {monthlyEstimate} from '../../../../../packages/contracts/src/subscription.js';
import {subscriptionView} from '../licensing/service.js';
import {updateSubscriptionInput,SubscriptionConflict,SubscriptionRuleRejected} from '../licensing/input.js';
import type {SubscriptionView} from '../../../../../packages/contracts/src/subscription.js';
import { createDefaultProfiles } from '../identity/default-profiles.js';
import mongoose from 'mongoose';
import { Company, Membership, Role, Session, Tenant, User } from '../identity/models.js';
import { hashPassword } from '../identity/security.js';
import { PlatformAudit } from './models.js';
import { newClientSchema, type NewClientInput } from './client-input.js';
import type { CustomerRegistration } from '../../../../../packages/contracts/src/customer.js';
export type NewClient = NewClientInput;
export interface ClientView {
  subscription?: SubscriptionView;registration?: CustomerRegistration;
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
  async create(raw: NewClient, adminId: string): Promise<ClientView> {
    const input = newClientSchema.parse(raw);
    const registration = { taxId: input.taxId, stateRegistration: input.stateRegistration, contactName: input.contactName, contactEmail: input.contactEmail, phone: input.phone, address: input.address, contract: input.contract };
    const trialStartedAt=input.subscription.mode==='trial'?new Date():null;const subscription={...input.subscription,trialStartedAt,trialEndsAt:trialStartedAt?new Date(trialStartedAt.valueOf()+30*86400000):null};
    const passwordHash = await hashPassword(input.adminPassword);
    try {
      return await mongoose.connection.transaction(async session => {
        if (await User.exists({ email: input.adminEmail }).session(session)) throw new ClientConflict();
        const [user] = await User.create([{ name: input.adminName, email: input.adminEmail, passwordHash,mustChangePassword:true }], { session });
        const [tenant] = await Tenant.create([{ name: input.name, slug: input.slug, primaryAdminId: user._id, registration,subscription }], { session });
        const [company] = await Company.create([{ tenantId: tenant._id, name: input.companyName }], { session });
        const [role] = await createDefaultProfiles(tenant._id,session);
        await Membership.create([{ userId: user._id, tenantId: tenant._id, companyIds: [company._id], roleIds: [role._id] }], { session });
        await PlatformAudit.create([{ adminId, tenantId: tenant._id, action: 'client.created' }], { session });
        return { id: String(tenant._id), name: tenant.name, slug: tenant.slug, active: tenant.active,
          registration,subscription:{...input.subscription,activeUsers:1,includedLicenses:25,...monthlyEstimate(input.subscription.licenseLimit,input.subscription.baseMonthlyCents,input.subscription.extraSeatMonthlyCents),trialStartedAt:subscription.trialStartedAt?.toISOString()??null,trialEndsAt:subscription.trialEndsAt?.toISOString()??null,expired:false,version:0}, companyName: company.name, admin: { name: user.name, email: user.email }, createdAt: tenant.createdAt.toISOString() };
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
        subscription:await subscriptionView(tenant),registration: tenant.toObject().registration as CustomerRegistration | undefined,
        companyName: company?.name ?? '', admin: user ? { name: user.name, email: user.email } : null,
        createdAt: tenant.createdAt.toISOString() };
    }));
    return { items, total, page: input.page, pageSize: 20 };
  },
  async setSubscription(tenantId:string,raw:unknown,adminId:string){
    const input=updateSubscriptionInput.parse(raw);
    return mongoose.connection.transaction(async session=>{
      const tenant=await Tenant.findOneAndUpdate({_id:tenantId},{$inc:{licenseRevision:1}},{new:true,session});if(!tenant)return null;
      if(tenant.subscriptionVersion!==input.version)throw new SubscriptionConflict();
      if(input.mode==='trial'&&tenant.subscription.mode!=='trial'&&tenant.subscription.trialStartedAt)throw new SubscriptionRuleRejected();
      const activeUsers=await Membership.countDocuments({tenantId,active:true}).session(session);if(activeUsers>input.licenseLimit)throw new SubscriptionRuleRejected();
      const before=tenant.toObject().subscription;const {version,...fields}=input;
      const firstTrial=fields.mode==='trial'&&tenant.subscription.mode!=='trial';const start=firstTrial?new Date():null;
      tenant.set({subscription:{...tenant.toObject().subscription,...fields,...(start?{trialStartedAt:start,trialEndsAt:new Date(start.valueOf()+30*86400000)}:{})}});tenant.subscriptionVersion++;await tenant.save({session});
      await PlatformAudit.create([{adminId,tenantId,action:'client.subscription.updated',subscriptionBefore:before,subscriptionAfter:tenant.toObject().subscription}],{session});
      return {id:String(tenant._id),subscription:{...fields,activeUsers,includedLicenses:25,...monthlyEstimate(fields.licenseLimit,fields.baseMonthlyCents,fields.extraSeatMonthlyCents),trialStartedAt:tenant.subscription.trialStartedAt?.toISOString()??null,trialEndsAt:tenant.subscription.trialEndsAt?.toISOString()??null,expired:fields.mode==='trial'&&(!tenant.subscription.trialEndsAt||new Date()>=tenant.subscription.trialEndsAt),version:tenant.subscriptionVersion}};
    });
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
