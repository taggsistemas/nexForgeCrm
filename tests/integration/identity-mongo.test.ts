import request from 'supertest';
import { createApp } from '../../apps/api/src/app.js';
import { newSessionToken, tokenHash } from '../../apps/api/src/modules/identity/security.js';
import { scopedFilter } from '../../apps/api/src/infrastructure/access.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { User, Tenant, Company, Role, Membership, Session } from '../../apps/api/src/modules/identity/models.js';
import { hashPassword } from '../../apps/api/src/modules/identity/security.js';
import { identityService } from '../../apps/api/src/modules/identity/service.js';
const uri = process.env.MONGODB_TEST_URI;
const database = 'nexforge_crm_test_' + randomUUID().replaceAll('-', '');
describe.skipIf(!uri)('identity persistence in an isolated MongoDB test database', () => {
  beforeAll(async () => {
    // Never run tests in a configured application database; always allocate a new DB.
    await mongoose.connect(uri!, { dbName: database, serverSelectionTimeoutMS: 10000 });
    await Promise.all([User.init(), Tenant.init(), Company.init(), Role.init(), Membership.init(), Session.init()]);
  }, 30000);
  afterAll(async () => {
    try {
      if (mongoose.connection.name === database) await mongoose.connection.dropDatabase();
    } finally { await mongoose.disconnect(); }
  });
  it('rejects another tenant, filters cross-tenant references and revokes sessions', async () => {
    const password = 'integration-test-password-only';
    const user = await User.create({ name: 'Test User', email: 'identity@example.invalid', passwordHash: await hashPassword(password) });
    const a = await Tenant.create({ name: 'Tenant A', slug: 'tenant-a' });
    const b = await Tenant.create({ name: 'Tenant B', slug: 'tenant-b' });
    const companyA = await Company.create({ tenantId: a._id, name: 'Company A' });
    const companyB = await Company.create({ tenantId: b._id, name: 'Company B' });
    const roleA = await Role.create({ tenantId: a._id, name: 'Reader', permissions: ['lead:read'] });
    const roleB = await Role.create({ tenantId: b._id, name: 'Approver', permissions: ['proposal:approve'] });
    const membership = await Membership.create({ userId: user._id, tenantId: a._id, companyIds: [companyA._id, companyB._id], roleIds: [roleA._id, roleB._id] });
    await Membership.updateOne({ _id: membership._id }, { active: false });
    expect(await identityService.login(user.email, password)).toBeNull();
    await Membership.updateOne({ _id: membership._id }, { active: true });
    const ambiguous = await Membership.create({ userId: user._id, tenantId: b._id, companyIds: [companyB._id], roleIds: [roleB._id] });
    expect(await identityService.login(user.email, password)).toBeNull();
    await Membership.deleteOne({ _id: ambiguous._id });
    expect(await identityService.login(user.email, 'wrong')).toBeNull();
    const login = await identityService.login(user.email, password);
    expect(login).not.toBeNull();
    if (!login) throw new Error('Expected a verified session');
    expect(login.context.companyIds).toEqual([String(companyA._id)]);
    expect(login.context.permissions).toEqual(['lead:read']);
    expect(await identityService.authenticate(login.token)).not.toBeNull();
    await Membership.updateOne({ _id: membership._id }, { active: false });
    expect(await identityService.authenticate(login.token)).toBeNull();
    await Membership.updateOne({ _id: membership._id }, { active: true });
    await identityService.logout(login.token);
    expect(await identityService.authenticate(login.token)).toBeNull();
    const expiring = await identityService.login(user.email, password);
    if (!expiring) throw new Error('Expected a verified session');
    await Session.updateMany({ userId: user._id }, { expiresAt: new Date(0) });
    expect(await identityService.authenticate(expiring.token)).toBeNull();
  }, 30000);
  it('isolates reads, updates and deletes across two real tenant sessions', async () => {
    const password = 'tenant-isolation-test-password';
    const passwordHash = await hashPassword(password);
    const records = mongoose.model('TenantIsolationProbe', new mongoose.Schema({
      tenantId: { type: mongoose.Schema.Types.ObjectId, required: true },
      companyId: { type: mongoose.Schema.Types.ObjectId, required: true },
      name: String,
    }, { strict: 'throw' }));
    const setup = async (suffix: string) => {
      const user = await User.create({ name: suffix, email: suffix + '@example.invalid', passwordHash });
      const tenant = await Tenant.create({ name: suffix, slug: suffix });
      const company = await Company.create({ name: suffix, tenantId: tenant._id });
      const role = await Role.create({ name: 'Admin', tenantId: tenant._id, permissions: ['lead:read','lead:write'] });
      await Membership.create({ userId: user._id, tenantId: tenant._id, companyIds: [company._id], roleIds: [role._id] });
      const login = await identityService.login(user.email, password);
      if (!login) throw new Error('Missing tenant test session');
      return { company, login, record: await records.create({ tenantId: tenant._id, companyId: company._id, name: suffix }) };
    };
    const a = await setup('isolation-a'), b = await setup('isolation-b');
    const verified = await identityService.authenticate(a.login.token);
    if (!verified) throw new Error('Missing verified session');
    const filter = (permission: 'lead:read' | 'lead:write') => scopedFilter(verified.context, String(a.company._id), permission, { _id: b.record._id });
    expect(await records.findOne(filter('lead:read'))).toBeNull();
    expect((await records.updateOne(filter('lead:write'), { $set: { name: 'unauthorized' } })).matchedCount).toBe(0);
    expect((await records.deleteOne(filter('lead:write'))).deletedCount).toBe(0);
    expect((await records.findById(b.record._id))?.name).toBe('isolation-b');
    expect(() => scopedFilter(verified.context, String(b.company._id), 'lead:read')).toThrow();
    const verifiedB = await identityService.authenticate(b.login.token);
    if (!verifiedB) throw new Error('Missing second verified session');
    expect(await records.findOne(scopedFilter(verifiedB.context, String(b.company._id), 'lead:read', { _id: b.record._id }))).not.toBeNull();
  }, 30000);

  it('keeps only the latest client login, including concurrent requests and stale logout', async () => {
    const password='single-client-test-password';
    const user=await User.create({name:'Single',email:'single@example.invalid',passwordHash:await hashPassword(password)});
    const tenant=await Tenant.create({name:'Single',slug:'single'});
    const company=await Company.create({tenantId:tenant._id,name:'Single'});
    const role=await Role.create({tenantId:tenant._id,name:'Seller',key:'seller',permissions:[]});
    await Membership.create({userId:user._id,tenantId:tenant._id,companyIds:[company._id],roleIds:[role._id]});
    const origin='http://localhost:5173',app=createApp({origin,databaseReady:()=>true,identity:identityService});
    const login=(device:string)=>request(app).post('/api/v1/auth/login').set('User-Agent',device).set('Origin',origin).send({email:user.email,password});
    const first=await login('Desktop Windows'),second=await login('Mobile Android');
    expect(first.status).toBe(200);expect(second.status).toBe(200);
    const cookie=(response: {headers:Record<string,unknown>})=>String(response.headers['set-cookie']).split(';')[0];
    expect((await request(app).get('/api/v1/auth/session').set('Cookie',cookie(first))).status).toBe(401);
    expect((await request(app).get('/api/v1/auth/session').set('Cookie',cookie(second))).status).toBe(200);
    await request(app).post('/api/v1/auth/logout').set('Origin',origin).set('Cookie',cookie(first));
    expect((await request(app).get('/api/v1/auth/session').set('Cookie',cookie(second))).status).toBe(200);
    await Session.deleteMany({userId:user._id});
    const simultaneous=await Promise.all([identityService.login(user.email,password),identityService.login(user.email,password),identityService.login(user.email,password)]);
    const states=await Promise.all(simultaneous.map(session=>session?identityService.authenticate(session.token):null));
    expect(states.filter(Boolean)).toHaveLength(1);
    expect(await Session.countDocuments({userId:user._id})).toBe(1);
    const legacy=newSessionToken();
    await Session.create({userId:user._id,tenantId:tenant._id,tokenHash:tokenHash(legacy),expiresAt:new Date(Date.now()+60000)});
    expect(await identityService.authenticate(legacy)).toBeNull();
  },30000);

});
