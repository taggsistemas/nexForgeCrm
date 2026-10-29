import {auditActorNames} from '../../apps/api/src/infrastructure/audit-actors.js';
import {relationshipDashboard} from '../../apps/api/src/modules/relationships/dashboard.js';
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import mongoose from 'mongoose';
import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {createApp} from '../../apps/api/src/app.js';
import {initializeClientModels,platformClients} from '../../apps/api/src/modules/platform/clients.js';
import {PlatformAdmin} from '../../apps/api/src/modules/platform/models.js';
import {AdministrationAudit} from '../../apps/api/src/modules/administration/models.js';
import {administrationService} from '../../apps/api/src/modules/administration/service.js';
import {identityService} from '../../apps/api/src/modules/identity/service.js';
import {hashPassword} from '../../apps/api/src/modules/identity/security.js';
import {relationshipService} from '../../apps/api/src/modules/relationships/service.js';
import {qualificationWorkflow} from '../../apps/api/src/modules/relationships/qualification-workflow.js';
import {initializeRelationshipModels,Party,Contact,QualificationSubmission,QualificationAudit} from '../../apps/api/src/modules/relationships/models.js';
import {initializeAccountSecurityModels} from '../../apps/api/src/modules/account-security/models.js';
import {customerRegistrationFixture} from '../fixtures/customer.js';
import {prepareAccount} from '../fixtures/ready-account.js';
import {seedRelationship} from '../fixtures/relationships.js';
type Login=NonNullable<Awaited<ReturnType<typeof identityService.login>>>;
const uri=process.env.MONGODB_TEST_URI,database='nexforge_crm_test_'+randomUUID().replaceAll('-',''),origin='http://localhost:5173';
let a:Login,b:Login,s1:Login,s2:Login,sales:Login,supervisor:Login,director:Login,auditor:Login,company:string,companyB:string;
const app=createApp({origin,databaseReady:()=>true,identity:identityService}),headers=(login:Login)=>({Origin:origin,Cookie:'nf_session='+login.token}),base=()=>'/api/v1/companies/'+company+'/crm',path=(id:string)=>base()+'/parties/'+id+'/qualification';
const complete=(version:number,taxId='11222333000181')=>({version,contactName:'Ana Compras',legalName:'Acme Ltda',taxId,registrationStatus:'isento',email:'contact@example.invalid',phone:'42999999999',customerType:'atacado',address:{postalCode:'85010000',street:'Rua Teste',number:'100',neighborhood:'Centro',city:'Guarapuava',state:'PR',country:'Brasil'},commercial:{creditLimitCents:150000,paymentMethods:['pix','boleto'],paymentTermDays:[30,60]}});
async function submitted(login:Login,taxId:string){const lead=await relationshipService.create(login.context,company,'lead',{name:'Qualificar '+taxId,phone:'42999999999'});await qualificationWorkflow.save(login.context,company,lead.id,complete(0,taxId));const sent=await qualificationWorkflow.submit(login.context,company,lead.id,{version:1});return sent.record;}
describe.skipIf(!uri)('relationships and reviewed qualification: real MongoDB authorization, approval and concurrency',()=>{
 beforeAll(async()=>{
  await mongoose.connect(uri!,{dbName:database,serverSelectionTimeoutMS:10000});await Promise.all([initializeClientModels(),initializeRelationshipModels(),initializeAccountSecurityModels(),AdministrationAudit.init(),PlatformAdmin.init()]);
  const password='relationships-test-password',master=await PlatformAdmin.create({name:'Master',email:'rel-master@example.invalid',passwordHash:await hashPassword(password)});
  const tenant=async(name:string)=>{const c=await platformClients.create({...customerRegistrationFixture,name,slug:name,companyName:name,adminName:name,adminEmail:name+'@example.invalid',adminPassword:password},String(master._id));await prepareAccount(c.admin!.email);return (await identityService.login(c.admin!.email,password))!;};
  a=await tenant('relationship-a');b=await tenant('relationship-b');company=a.context.companyIds[0]!;companyB=b.context.companyIds[0]!;
  const user=async(name:string,profileKey:'seller'|'sales_admin'|'supervisor'|'director'|'auditor',supervisedUserIds:string[]=[])=>{const u=await administrationService.create(a.context,{name,email:name+'@example.invalid',password,profileKey,companyIds:[company],supervisedUserIds});await prepareAccount(u.email);return (await identityService.login(u.email,password))!;};
  s1=await user('rel-seller-one','seller');s2=await user('rel-seller-two','seller');sales=await user('rel-sales','sales_admin');supervisor=await user('rel-supervisor','supervisor',[s1.context.userId]);director=await user('rel-director','director');auditor=await user('rel-auditor','auditor');
 },30000);
 afterAll(async()=>{try{if(mongoose.connection.name===database)await mongoose.connection.dropDatabase();}finally{await mongoose.disconnect();}});
 it('keeps intake minimal, blocks conversion/customer shortcuts and preserves scoped contacts and transfers',async()=>{
  const initial=await request(app).post(base()+'/leads').set(headers(s1)).send({name:'Primeiro contato',email:'prospect@example.invalid'});expect(initial.status).toBe(201);const lead=initial.body.record;expect(lead.taxId).toBe('');expect(lead.qualification.state).toBe('none');
  for(const body of [{name:'Sem canal'},{name:'Escalação',phone:'42999999999',stage:'qualificado'},{name:'Documento',phone:'42999999999',taxId:'11222333000181'},{name:'Injetado',phone:'42999999999',tenantId:b.context.tenantId}])expect((await request(app).post(base()+'/leads').set(headers(s1)).send(body)).status).toBe(400);
  expect((await request(app).post(base()+'/customers').set(headers(a)).send({name:'Atalho'})).status).toBe(400);expect((await request(app).post(base()+'/leads/'+lead.id+'/convert').set(headers(s1)).send({version:0,customerType:'atacado'})).body.code).toBe('QUALIFICATION_WORKFLOW_REQUIRED');
  expect((await request(app).patch(base()+'/leads/'+lead.id).set(headers(s1)).send({version:0,stage:'qualificado'})).status).toBe(400);
  expect((await request(app).patch(base()+'/leads/'+lead.id).set(headers(s1)).send({version:0,stage:'em_contato'})).status).toBe(200);
  const contact=await relationshipService.createContact(s1.context,company,lead.id,{name:'Contato Acme'});expect((await request(app).get(base()+'/parties/'+lead.id+'/contacts').set(headers(s2))).status).toBe(404);
  const writes=await Promise.all(['A','B'].map(name=>request(app).patch(base()+'/leads/'+lead.id).set(headers(a)).send({name,version:1,ownerId:s2.context.userId})));expect(writes.map(row=>row.status).sort()).toEqual([200,409]);expect((await Contact.findById(contact.id))!.ownerId.toString()).toBe(s2.context.userId);
  expect((await request(app).get(path(lead.id)).set(headers(s1))).status).toBe(404);expect((await request(app).get(path(lead.id)).set(headers(b))).status).toBe(403);
  const current=(await Party.findById(lead.id))!;await relationshipService.archive(s2.context,company,'lead',lead.id,{version:current.version});expect((await Contact.findById(contact.id))!.archived).toBe(true);
  await relationshipService.create(a.context,company,'lead',{name:'Literal .*',phone:'42999999999'});expect((await request(app).get(base()+'/leads').query({search:'.*'}).set(headers(a))).body.total).toBe(1);
 },30000);
 it('requires complete data, allows return with reason and converts only after a distinct reviewer approves',async()=>{
  const lead=await relationshipService.create(s1.context,company,'lead',{name:'Acme',phone:'42999999999'}),contact=await relationshipService.createContact(s1.context,company,lead.id,{name:'Preservado'});
  await qualificationWorkflow.save(s1.context,company,lead.id,{version:0,contactName:'Ana'});expect((await request(app).post(path(lead.id)+'/submit').set(headers(s1)).send({version:1})).body.code).toBe('LEAD_QUALIFICATION_REQUIRED');
  await qualificationWorkflow.save(s1.context,company,lead.id,complete(1));await qualificationWorkflow.submit(s1.context,company,lead.id,{version:2});
  for(const login of [s1,supervisor])expect((await request(app).post(path(lead.id)+'/approve').set(headers(login)).send({version:3})).status).toBe(403);
  expect((await request(app).patch(base()+'/leads/'+lead.id).set(headers(s1)).send({version:3,name:'Mudou'})).status).toBe(400);expect((await request(app).post(base()+'/leads/'+lead.id+'/archive').set(headers(s1)).send({version:3})).status).toBe(400);
  expect((await request(app).post(path(lead.id)+'/return').set(headers(sales)).send({version:3,reason:'curto'})).status).toBe(400);
  const returned=await qualificationWorkflow.decide(sales.context,company,lead.id,'return',{version:3,reason:'Corrigir endereço e prazo comercial'});expect(returned.record.qualification!.state).toBe('revision');expect(returned.record.kind).toBe('lead');
  await qualificationWorkflow.save(s1.context,company,lead.id,{version:4,address:{number:'101'}});await qualificationWorkflow.submit(s1.context,company,lead.id,{version:5});
  const outcomes=await Promise.all([1,2].map(()=>request(app).post(path(lead.id)+'/approve').set(headers(sales)).send({version:6})));expect(outcomes.map(row=>row.status).sort()).toEqual([200,409]);
  const customer=(await Party.findById(lead.id))!;expect(customer.kind).toBe('customer');expect(customer.qualificationState).toBe('approved');expect(customer.approvedBy!.toString()).toBe(sales.context.userId);expect(customer.commercial.creditLimitCents).toBe(150000);expect(customer.address.number).toBe('101');
  expect((await relationshipService.contacts(s1.context,company,lead.id,{})).items[0].id).toBe(contact.id);const snapshots=await QualificationSubmission.find({partyId:lead.id}).sort({revision:1});expect(snapshots).toHaveLength(2);expect(snapshots[0]!.snapshot.address.number).toBe('100');expect(snapshots[1]!.snapshot.address.number).toBe('101');
  expect((await request(app).patch(base()+'/customers/'+lead.id).set(headers(s1)).send({version:7,commercial:{creditLimitCents:999999}})).status).toBe(400);
 },30000);
 it('rejects self-approval and rolls back conversion and approval when audit persistence fails',async()=>{
  const row=await submitted(sales,'52998224725');expect((await request(app).post(path(row.id)+'/approve').set(headers(sales)).send({version:row.version})).body.code).toBe('SELF_APPROVAL_REJECTED');
  const fail=vi.spyOn(QualificationAudit,'create').mockRejectedValueOnce(Error('audit unavailable'));
  try{await expect(qualificationWorkflow.decide(a.context,company,row.id,'approve',{version:row.version})).rejects.toThrow('audit unavailable');}finally{fail.mockRestore();}
  const saved=(await Party.findById(row.id))!;expect(saved.kind).toBe('lead');expect(saved.qualificationState).toBe('submitted');expect(saved.approvedAt).toBeNull();expect(saved.version).toBe(row.version);
  await qualificationWorkflow.decide(a.context,company,row.id,'approve',{version:row.version});
 },30000);
 it('lets direction review and approve with financial data while auditing stays read only',async()=>{
  const row=await submitted(s1,'39053344705'),approve={version:row.version};
  const seen=await request(app).get(path(row.id)).set(headers(director));expect(seen.status).toBe(200);expect(seen.body.canApprove).toBe(true);expect(seen.body.record.qualification.commercial.creditLimitCents).toBe(150000);
  const audited=await request(app).get(path(row.id)).set(headers(auditor));expect(audited.status).toBe(200);expect(audited.body.canApprove).toBe(false);
  for(const login of [director,auditor]){expect((await request(app).patch(path(row.id)).set(headers(login)).send(complete(row.version))).status).toBe(403);expect((await request(app).post(base()+'/leads').set(headers(login)).send({name:'Lead indevido',phone:'42999999999'})).status).toBe(403);}
  expect((await request(app).post(path(row.id)+'/approve').set(headers(auditor)).send(approve)).status).toBe(403);
  expect((await request(app).post('/api/v1/companies/'+company+'/offline/prepare').set(headers(auditor)).send({})).status).toBe(403);
  const done=await request(app).post(path(row.id)+'/approve').set(headers(director)).send(approve);expect(done.status).toBe(200);expect(done.body.record.kind).toBe('customer');
  const events=await QualificationAudit.find({partyId:row.id,action:'approved'});expect(events.map(event=>String(event.actorId))).toEqual([director.context.userId]);
 },30000);
 it('invalidates submitted snapshots on transfer, revokes former access and supports re-submission',async()=>{
  const row=await submitted(s1,'11144477735');await expect(relationshipService.update(a.context,company,'lead',row.id,{version:row.version,ownerId:s2.context.userId})).rejects.toThrow();
  // The ordinary form is frozen; a real portfolio transfer still changes version/ownership atomically.
  const {territoryCatalog}=await import('../../apps/api/src/modules/territories/catalog.js');const {initializeTerritoryModels}=await import('../../apps/api/src/modules/territories/models.js');await initializeTerritoryModels();
  const book=await territoryCatalog.savePortfolio(a.context,company,null,{name:'Transferência pendente',ownerId:s2.context.userId});await territoryCatalog.transfer(a.context,company,{portfolioId:book.id,entries:[{partyId:row.id,version:row.version}]});
  expect((await request(app).get(path(row.id)).set(headers(s1))).status).toBe(404);expect((await request(app).get(path(row.id)).set(headers(supervisor))).status).toBe(404);expect((await request(app).get(path(row.id)).set(headers(sales))).body.submission.stale).toBe(true);
  expect((await request(app).post(path(row.id)+'/approve').set(headers(sales)).send({version:row.version+1})).status).toBe(409);
  await qualificationWorkflow.decide(sales.context,company,row.id,'return',{version:row.version+1,reason:'Revalidar condições após transferência'});await qualificationWorkflow.submit(s2.context,company,row.id,{version:row.version+2});await qualificationWorkflow.decide(sales.context,company,row.id,'approve',{version:row.version+3});
 },30000);
 it('enforces fiscal uniqueness within company while allowing the same document in another tenant',async()=>{
  const foreign=await relationshipService.create(b.context,companyB,'lead',{name:'Outra organização',phone:'42999999999'});await qualificationWorkflow.save(b.context,companyB,foreign.id,complete(0));expect((await Party.findById(foreign.id))!.taxId).toBe('11222333000181');
  const duplicate=await relationshipService.create(s1.context,company,'lead',{name:'Duplicado',email:'duplicate@example.invalid'});expect((await request(app).patch(path(duplicate.id)).set(headers(s1)).send(complete(0))).status).toBe(409);expect((await Party.findById(duplicate.id))!.taxId).toBe('');
  expect((await request(app).get('/api/v1/companies/'+companyB+'/crm/parties/'+foreign.id+'/qualification').set(headers(sales))).status).toBe(403);
 },30000);
 it('keeps existing customers intact until an explicit regularization and rejects foreign or mass-assigned qualification data',async()=>{
  const legacy=await seedRelationship(s1.context,company,'customer',{name:'Legado'});expect(legacy.qualification!.state).toBe('none');expect((await Party.findById(legacy.id))!.kind).toBe('customer');
  for(const extra of [{approvedBy:a.context.userId},{tenantId:b.context.tenantId},{commercial:{creditLimitCents:{$gt:0}}},{stage:'qualificado'}])expect((await request(app).patch(path(legacy.id)).set(headers(s1)).send({version:0,...extra})).status).toBe(400);
  expect((await request(app).patch(path(legacy.id)).set(headers(b)).send(complete(0))).status).toBe(403);expect((await request(app).get(path(legacy.id)).set(headers(s2))).status).toBe(404);
  await qualificationWorkflow.save(s1.context,company,legacy.id,complete(0,'12345678909'));await qualificationWorkflow.submit(s1.context,company,legacy.id,{version:1});const done=await qualificationWorkflow.decide(sales.context,company,legacy.id,'approve',{version:2});expect(done.record.id).toBe(legacy.id);expect(done.record.kind).toBe('customer');expect(done.record.qualification!.state).toBe('approved');
 },30000);
 it('aggregates monthly dashboard only after live owner tenant and company authorization',async()=>{const now=new Date('2030-01-15T12:00:00Z'),before=await relationshipDashboard(s1.context,company,{},now),stamp=new Date('2030-01-10T12:00:00Z'),base={tenantId:s1.context.tenantId,companyId:company,ownerId:s1.context.userId,kind:'lead',name:'Dashboard synthetic record',address:{country:'Brasil'},createdAt:stamp};await Party.create([{...base,qualificationState:'revision'},{...base,kind:'customer',qualificationState:'approved',approvedAt:stamp},{...base,ownerId:s2.context.userId},{...base,tenantId:b.context.tenantId,companyId:companyB,ownerId:b.context.userId},{...base,archived:true}]);const after=await relationshipDashboard(s1.context,company,{},now);expect(after.months[5]!.created-before.months[5]!.created).toBe(2);expect(after.months[5]!.approved-before.months[5]!.approved).toBe(1);await expect(relationshipDashboard(s1.context,companyB,{},now)).rejects.toThrow();},30000);

 it('resolves audit names inside the tenant without exposing another tenant actor',async()=>{const names=await auditActorNames(a.context.tenantId,[a.context.userId,sales.context.userId,b.context.userId]);expect(names.get(a.context.userId)).toBe(a.view.user.name);expect(names.get(sales.context.userId)).toBe(sales.view.user.name);expect(names.has(b.context.userId)).toBe(false);});

});
