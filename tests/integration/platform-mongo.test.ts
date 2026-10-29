import { customerRegistrationFixture } from '../fixtures/customer.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { Company, Membership, Role, Session, Tenant, User } from '../../apps/api/src/modules/identity/models.js';
import { PlatformAdmin, PlatformAudit, PlatformSession } from '../../apps/api/src/modules/platform/models.js';
import { hashPassword } from '../../apps/api/src/modules/identity/security.js';
import { identityService } from '../../apps/api/src/modules/identity/service.js';
import { platformAuth } from '../../apps/api/src/modules/platform/auth.js';
import { ClientConflict, initializeClientModels, platformClients } from '../../apps/api/src/modules/platform/clients.js';
import { profileKeys } from '../../packages/contracts/src/profiles.js';
const uri = process.env.MONGODB_TEST_URI, database = 'nexforge_crm_test_' + randomUUID().replaceAll('-', '');
describe.skipIf(!uri)('Tagg Master persistence and atomic provisioning (replica set)', () => {
  beforeAll(async () => {
    await mongoose.connect(uri!, { dbName: database, serverSelectionTimeoutMS: 10000 });
    await Promise.all([initializeClientModels(), PlatformAdmin.init(), PlatformSession.init(), Session.init()]);
  }, 30000);
  afterAll(async () => {
    try { if (mongoose.connection.name === database) await mongoose.connection.dropDatabase(); }
    finally { await mongoose.disconnect(); }
  });
  it('creates the client/admin atomically, rejects collisions and separates platform access', async () => {
    const password = 'integration-test-master-password';
    const master = await PlatformAdmin.create({ name: 'Master', email: 'master@example.invalid', passwordHash: await hashPassword(password) });
    const login = await platformAuth.login(master.email, password);
    expect(login).not.toBeNull();
    if (!login) throw new Error('Missing master session');
    expect(await platformAuth.authenticate(login.token)).not.toBeNull();
    const input = { ...customerRegistrationFixture, name: 'Client A', slug: 'client-a', companyName: 'Company A', adminName: 'Admin A', adminEmail: 'admin-a@example.invalid', adminPassword: 'client-admin-password' };
    const client = await platformClients.create(input, String(master._id));
    const tenant = await Tenant.findById(client.id);
    expect(tenant?.primaryAdminId).toBeDefined();
    expect(tenant?.registration?.taxId).toBe(input.taxId);
    expect(tenant?.registration?.address.street).toBe(input.address.street);
    expect(tenant?.registration?.contract.end).toBe(input.contract.end);
    expect(await Company.countDocuments({ tenantId: client.id })).toBe(1);
    expect(await Role.countDocuments({ tenantId: client.id })).toBe(profileKeys.length);
    expect(await Membership.countDocuments({ tenantId: client.id })).toBe(1);
    expect(await PlatformAudit.countDocuments({ tenantId: client.id, action: 'client.created' })).toBe(1);
    expect(JSON.stringify(client)).not.toContain(input.adminPassword);
    const clientLogin = await identityService.login(input.adminEmail, input.adminPassword);
    expect(clientLogin).not.toBeNull();
    if (!clientLogin) throw new Error('Missing client session');
    expect(await platformAuth.authenticate(clientLogin.token)).toBeNull();
    expect(await platformAuth.login(input.adminEmail, input.adminPassword)).toBeNull();
    await expect(platformClients.create({ ...input, adminEmail: 'rollback@example.invalid' }, String(master._id))).rejects.toBeInstanceOf(ClientConflict);
    expect(await User.exists({ email: 'rollback@example.invalid' })).toBeNull();
    await expect(platformClients.create({ ...input, slug: 'another-client' }, String(master._id))).rejects.toBeInstanceOf(ClientConflict);
    expect(await Tenant.exists({ slug: 'another-client' })).toBeNull();
    const list = await platformClients.list({ page: 1, search: 'Client A' });
    expect(list.total).toBe(1);
    expect(list.items[0].admin?.email).toBe(input.adminEmail);
    expect(list.items[0].registration?.contactEmail).toBe(input.contactEmail);
    expect((await platformClients.list({ page: 1, search: '.*' })).total).toBe(0);
    await platformClients.setActive(client.id, false, String(master._id));
    expect(await identityService.authenticate(clientLogin.token)).toBeNull();
    expect(await identityService.login(input.adminEmail, input.adminPassword)).toBeNull();
    expect(await Session.countDocuments({ tenantId: client.id })).toBe(0);
    await platformClients.setActive(client.id, true, String(master._id));
    expect(await identityService.login(input.adminEmail, input.adminPassword)).not.toBeNull();
    await PlatformAdmin.updateOne({ _id: master._id }, { active: false });
    expect(await platformAuth.authenticate(login.token)).toBeNull();
    await platformAuth.logout(login.token);
    expect(await PlatformSession.countDocuments({ adminId: master._id })).toBe(0);
  }, 30000);
  it('enforces single master session and does not revoke the latest login on stale logout',async()=>{
    const password='single-master-test-password';
    const admin=await PlatformAdmin.create({name:'Single Master',email:'single-master@example.invalid',passwordHash:await hashPassword(password)});
    const first=await platformAuth.login(admin.email,password),second=await platformAuth.login(admin.email,password);
    if(!first||!second)throw Error('Missing master session');
    expect(await platformAuth.authenticate(first.token)).toBeNull();
    expect(await platformAuth.authenticate(second.token)).not.toBeNull();
    await platformAuth.logout(first.token);
    expect(await platformAuth.authenticate(second.token)).not.toBeNull();
    await PlatformSession.deleteMany({adminId:admin._id});
    const logins=await Promise.all([platformAuth.login(admin.email,password),platformAuth.login(admin.email,password),platformAuth.login(admin.email,password)]);
    const valid=await Promise.all(logins.map(login=>login?platformAuth.authenticate(login.token):null));
    expect(valid.filter(Boolean)).toHaveLength(1);
    expect(await PlatformSession.countDocuments({adminId:admin._id})).toBe(1);
  },30000);

});
