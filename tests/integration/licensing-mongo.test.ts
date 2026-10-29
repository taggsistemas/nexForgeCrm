import {afterAll,beforeAll,describe,it,expect,vi} from 'vitest';
import mongoose from 'mongoose';
import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {createApp} from '../../apps/api/src/app.js';
import {initializeClientModels,platformClients} from '../../apps/api/src/modules/platform/clients.js';
import {PlatformAdmin,PlatformSession,PlatformAudit} from '../../apps/api/src/modules/platform/models.js';
import {platformAuth} from '../../apps/api/src/modules/platform/auth.js';
import {Tenant,Membership,User,Role} from '../../apps/api/src/modules/identity/models.js';
import {identityService} from '../../apps/api/src/modules/identity/service.js';
import {administrationService} from '../../apps/api/src/modules/administration/service.js';
import {AdministrationAudit} from '../../apps/api/src/modules/administration/models.js';
import {initializeAccountSecurityModels} from '../../apps/api/src/modules/account-security/models.js';
import {hashPassword} from '../../apps/api/src/modules/identity/security.js';
import {LicenseLimitReached,SubscriptionRuleRejected} from '../../apps/api/src/modules/licensing/input.js';
import {customerRegistrationFixture} from '../fixtures/customer.js';
import {prepareAccount} from '../fixtures/ready-account.js';
const uri=process.env.MONGODB_TEST_URI,db='nexforge_crm_test_'+randomUUID().replaceAll('-',''),origin='http://localhost:5173',password='licensing-test-password';
let master:string,masterToken:string;
const app=createApp({origin,databaseReady:()=>true,identity:identityService,platform:{auth:platformAuth,clients:platformClients}});
const create=(slug:string,subscription?:Record<string,unknown>)=>platformClients.create({...customerRegistrationFixture,name:slug,slug,companyName:slug,adminName:slug,adminEmail:slug+'@example.invalid',adminPassword:password,...(subscription?{subscription}:{} as {})} as Parameters<typeof platformClients.create>[0],master);
const headers=(token:string,master=false)=>({Origin:origin,Cookie:(master?'nf_master_session=':'nf_session=')+token});
describe.skipIf(!uri)('subscriptions: exact trial, active license concurrency and master-only changes',()=>{
 beforeAll(async()=>{await mongoose.connect(uri!,{dbName:db});await Promise.all([initializeClientModels(),PlatformAdmin.init(),PlatformSession.init(),AdministrationAudit.init(),initializeAccountSecurityModels()]);const admin=await PlatformAdmin.create({name:'Master',email:'license-master@example.invalid',passwordHash:await hashPassword(password)});master=String(admin._id);masterToken=(await platformAuth.login(admin.email,password))!.token;},30000);
 afterAll(async()=>{try{if(mongoose.connection.name===db)await mongoose.connection.dropDatabase();}finally{await mongoose.disconnect();}});
 it('starts a server-defined 30-day trial, rejects expired sessions and converts to paid without resetting trial',async()=>{
  const client=await create('trial-client',{mode:'trial'});expect(client.subscription!.licenseLimit).toBe(25);expect(Date.parse(client.subscription!.trialEndsAt!)-Date.parse(client.subscription!.trialStartedAt!)).toBe(30*86400000);await prepareAccount(client.admin!.email);const login=(await identityService.login(client.admin!.email,password))!;
  await Tenant.updateOne({_id:client.id},{$set:{'subscription.trialEndsAt':new Date(Date.now()-1000)}});expect(await identityService.authenticate(login.token)).toBeNull();expect((await request(app).post('/api/v1/auth/login').set('Origin',origin).send({email:client.admin!.email,password})).body.code).toBe('TRIAL_EXPIRED');
  await platformClients.setActive(client.id,false,master);await platformClients.setActive(client.id,true,master);await expect(identityService.login(client.admin!.email,password)).rejects.toThrow();
  const before=(await Tenant.findById(client.id))!.subscription.trialEndsAt;
  expect((await request(app).patch('/api/v1/taggmaster/clients/'+client.id+'/subscription').set(headers(login.token)).send({version:0,mode:'paid'})).status).toBe(401);
  const response=await request(app).patch('/api/v1/taggmaster/clients/'+client.id+'/subscription').set(headers(masterToken,true)).send({version:0,mode:'paid',licenseLimit:30,baseMonthlyCents:10000,extraSeatMonthlyCents:2000});expect(response.status).toBe(200);expect(response.body.client.subscription.estimatedMonthlyCents).toBe(20000);expect((await Tenant.findById(client.id))!.subscription.trialEndsAt).toEqual(before);expect(await identityService.login(client.admin!.email,password)).not.toBeNull();
  expect((await request(app).patch('/api/v1/taggmaster/clients/'+client.id+'/subscription').set(headers(masterToken,true)).send({version:0,mode:'paid',licenseLimit:40})).status).toBe(409);await expect(platformClients.setSubscription(client.id,{version:1,mode:'trial',licenseLimit:30},master)).rejects.toBeInstanceOf(SubscriptionRuleRejected);
 },30000);
 it('serializes the last seat, suspension/reactivation and limit reductions without orphan users',async()=>{
  const client=await create('licensed-client');await prepareAccount(client.admin!.email);const login=(await identityService.login(client.admin!.email,password))!,company=login.context.companyIds[0]!,seller=(await Role.findOne({tenantId:client.id,key:'seller'}))!,hash=await hashPassword(password);
  const users=await User.insertMany(Array.from({length:23},(_,i)=>({name:'Fixture '+i,email:'seat-'+i+'@example.invalid',passwordHash:hash})));await Membership.insertMany(users.map(user=>({tenantId:client.id,userId:user._id,companyIds:[company],roleIds:[seller._id]})));
  const input=(email:string)=>({name:'Seller',email,password,profileKey:'seller',companyIds:[company]});
  const race=await Promise.all(['last-a@example.invalid','last-b@example.invalid'].map(email=>administrationService.create(login.context,input(email)).then(value=>value,error=>error)));expect(race.filter(value=>value instanceof LicenseLimitReached)).toHaveLength(1);expect(await Membership.countDocuments({tenantId:client.id,active:true})).toBe(25);expect(await User.countDocuments({email:{$in:['last-a@example.invalid','last-b@example.invalid']}})).toBe(1);
  const denied=await request(app).post('/api/v1/admin/users').set(headers(login.token)).send(input('denied@example.invalid'));expect(denied.status).toBe(409);expect(denied.body.code).toBe('LICENSE_LIMIT_REACHED');
  await platformClients.setSubscription(client.id,{version:0,mode:'paid',licenseLimit:26},master);await administrationService.create(login.context,input('extra@example.invalid'));await expect(platformClients.setSubscription(client.id,{version:1,mode:'paid',licenseLimit:25},master)).rejects.toBeInstanceOf(SubscriptionRuleRejected);
  const target=String(users[0]!._id);await administrationService.update(login.context,target,{profileKey:'seller',active:false,supervisedUserIds:[]});
  const outcomes=await Promise.all([administrationService.update(login.context,target,{profileKey:'seller',active:true,supervisedUserIds:[]}),administrationService.create(login.context,input('racing-create@example.invalid'))].map(p=>p.then(()=>200,error=>error instanceof LicenseLimitReached?409:500)));expect(outcomes.sort()).toEqual([200,409]);expect(await Membership.countDocuments({tenantId:client.id,active:true})).toBe(26);
 },30000);
 it('rolls back plan/audit mutations and refuses frontend trial dates or unknown billing fields',async()=>{
  const client=await create('plan-rollback'),spy=vi.spyOn(PlatformAudit,'create').mockRejectedValueOnce(Error('audit unavailable'));
  try{await expect(platformClients.setSubscription(client.id,{version:0,mode:'paid',licenseLimit:30},master)).rejects.toThrow('audit unavailable');}finally{spy.mockRestore();}expect((await Tenant.findById(client.id))!.subscription.licenseLimit).toBe(25);
  for(const change of [{trialEndsAt:'2099-01-01'},{activeUsers:0},{licenseLimit:24},{tenantId:client.id}])expect((await request(app).patch('/api/v1/taggmaster/clients/'+client.id+'/subscription').set(headers(masterToken,true)).send({version:0,mode:'paid',...change})).status).toBe(400);
  const old=await Tenant.create({name:'Old tenant',slug:'old-tenant'});expect(old.subscription.mode).toBe('paid');expect(old.subscription.licenseLimit).toBe(25);const started=await platformClients.setSubscription(String(old._id),{version:0,mode:'trial',licenseLimit:25},master);expect(started!.subscription.mode).toBe('trial');expect(Date.parse(started!.subscription.trialEndsAt!)-Date.parse(started!.subscription.trialStartedAt!)).toBe(30*86400000);
 },30000);
});

