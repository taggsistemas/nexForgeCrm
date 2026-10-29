import {afterAll,beforeAll,describe,it,expect,vi} from 'vitest';
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
import {Party,initializeRelationshipModels} from '../../apps/api/src/modules/relationships/models.js';
import {Tenant} from '../../apps/api/src/modules/identity/models.js';
import {initializeAccountSecurityModels} from '../../apps/api/src/modules/account-security/models.js';
import {AgendaActivity,initializeAgendaModels} from '../../apps/api/src/modules/agenda/models.js';
import {agendaService} from '../../apps/api/src/modules/agenda/service.js';
import {FieldExecution,initializeFieldVisitModels} from '../../apps/api/src/modules/field-visits/models.js';
import {fieldVisitService} from '../../apps/api/src/modules/field-visits/service.js';
import {offlineService} from '../../apps/api/src/modules/offline/service.js';
import {OfflineGrant,OfflineReceipt,OfflineVisitReport,OfflineAudit,initializeOfflineModels} from '../../apps/api/src/modules/offline/models.js';
import {customerRegistrationFixture} from '../fixtures/customer.js';
import {prepareAccount} from '../fixtures/ready-account.js';
import {dateParts} from '../../packages/contracts/src/agenda.js';
type Login=NonNullable<Awaited<ReturnType<typeof identityService.login>>>;
const uri=process.env.MONGODB_TEST_URI,db='nexforge_crm_test_'+randomUUID().replaceAll('-',''),origin='http://localhost:5173',password='offline-test-password';
let a:Login,b:Login,s1:Login,s2:Login,company:string,companyB:string;
const app=createApp({origin,databaseReady:()=>true,identity:identityService}),base=()=>'/api/v1/companies/'+company+'/offline',headers=(login:Login)=>({Origin:origin,Cookie:'nf_session='+login.token}),point={latitude:-25.39,longitude:-51.46,accuracy:15};
async function fixture(name:string,visit=false){const party=await relationshipService.create(s1.context,company,'lead',{name,phone:'42999999999'});let activity:InstanceType<typeof AgendaActivity>|null=null;if(visit){await agendaService.create(s1.context,company,{link:{source:'party',id:party.id},title:name,type:'visita',startLocal:dateParts(new Date(),'America/Sao_Paulo').date+'T09:00',timeZone:'America/Sao_Paulo'});activity=await AgendaActivity.findOne({partyId:party.id});}const snapshot=await offlineService.prepare(s1.context,company,{},s1.token);return {party,activity,snapshot};}
const task=(partyId:string)=>({kind:'activity',operationId:randomUUID(),partyId,partyVersion:0,capturedAt:new Date().toISOString(),title:'Ligar offline',type:'ligacao',dueAt:new Date().toISOString(),notes:'Relato independente'});
describe.skipIf(!uri)('offline: grants, current authorization, transactional idempotency and distinct visit evidence',()=>{
 beforeAll(async()=>{await mongoose.connect(uri!,{dbName:db});await Promise.all([initializeClientModels(),initializeRelationshipModels(),initializeAccountSecurityModels(),initializeAgendaModels(),initializeFieldVisitModels(),initializeOfflineModels(),AdministrationAudit.init(),PlatformAdmin.init()]);const master=await PlatformAdmin.create({name:'Master',email:'offline-master@example.invalid',passwordHash:await hashPassword(password)});const tenant=async(name:string)=>{const c=await platformClients.create({...customerRegistrationFixture,name,slug:name,companyName:name,adminName:name,adminEmail:name+'@example.invalid',adminPassword:password},String(master._id));await prepareAccount(c.admin!.email);return (await identityService.login(c.admin!.email,password))!;};a=await tenant('offline-a');b=await tenant('offline-b');company=a.context.companyIds[0]!;companyB=b.context.companyIds[0]!;const seller=async(name:string)=>{const user=await administrationService.create(a.context,{name,email:name+'@example.invalid',password,profileKey:'seller',companyIds:[company]});await prepareAccount(user.email);return (await identityService.login(user.email,password))!;};s1=await seller('offline-seller-one');s2=await seller('offline-seller-two');},90000);
 afterAll(async()=>{try{if(mongoose.connection.name===db)await mongoose.connection.dropDatabase();}finally{await mongoose.disconnect();}});
 it('downloads a minimized current portfolio with session-limited validity and rejects scope injection',async()=>{
  const {party}=await fixture('Carteira');await relationshipService.create(s2.context,company,'lead',{name:'Outro vendedor',phone:'42999999999'});
  const response=await request(app).post(base()+'/prepare').set(headers(s1)).send({});expect(response.status).toBe(200);expect(response.body.parties.map((row:{id:string})=>row.id)).toContain(party.id);expect(response.body.parties.map((row:{name:string})=>row.name)).not.toContain('Outro vendedor');expect(response.body.parties[0]).not.toHaveProperty('taxId');expect(response.body.parties[0]).not.toHaveProperty('commercial');expect(Date.parse(response.body.expiresAt)-Date.parse(response.body.issuedAt)).toBeLessThanOrEqual(8*3600000);
  expect((await request(app).post(base()+'/prepare').set(headers(s1)).send({tenantId:b.context.tenantId})).status).toBe(400);expect((await request(app).post(base()+'/prepare').set(headers(b)).send({})).status).toBe(403);expect((await request(app).post(base()+'/prepare').set('Cookie','nf_session='+s1.token).send({})).status).toBe(403);
 },30000);
 it('applies concurrent retries exactly once and rejects mutated operation identities',async()=>{
  const {party,snapshot}=await fixture('Idempotência'),operation=task(party.id),body={grantId:snapshot.grantId,operation};const results=await Promise.all([1,2,3].map(()=>request(app).post(base()+'/sync').set(headers(s1)).send(body)));expect(results.map(row=>row.status)).toEqual([200,200,200]);expect(new Set(results.map(row=>row.body.entityId)).size).toBe(1);expect(await AgendaActivity.countDocuments({partyId:party.id})).toBe(1);expect(await OfflineReceipt.countDocuments({operationId:operation.operationId})).toBe(1);
  expect((await request(app).post(base()+'/sync').set(headers(s1)).send({...body,operation:{...operation,title:'Alterado'}})).body.code).toBe('OFFLINE_IDEMPOTENCY_MISMATCH');
  await relationshipService.update(s1.context,company,'lead',party.id,{version:0,notes:'Mudou'});expect((await request(app).post(base()+'/sync').set(headers(s1)).send({...body,operation:{...operation,operationId:randomUUID()}})).status).toBe(409);expect((await request(app).post(base()+'/sync').set(headers(s1)).send(body)).status).toBe(200);
 },30000);
 it('stores reported visit times separately and closes the agenda without fabricating an online execution',async()=>{
  const {party,activity,snapshot}=await fixture('Visita offline',true),at=new Date(),operation={kind:'visit',operationId:randomUUID(),partyId:party.id,partyVersion:0,activityId:String(activity!._id),activityVersion:0,capturedAt:at.toISOString(),observedInAt:new Date(at.valueOf()-1000).toISOString(),observedOutAt:at.toISOString(),checkIn:point,checkOut:point,locationAuthorized:true,outcome:'realizada',notes:'Visita em campo sem conexão',nextSteps:'Retornar proposta'};
  const response=await request(app).post(base()+'/sync').set(headers(s1)).send({grantId:snapshot.grantId,operation});expect(response.status).toBe(200);const report=(await OfflineVisitReport.findById(response.body.entityId))!;expect(report.receivedAt.valueOf()).toBeGreaterThanOrEqual(at.valueOf());expect(report.observedInAt.toISOString()).toBe(operation.observedInAt);expect(await FieldExecution.countDocuments({activityId:activity!._id})).toBe(0);const saved=(await AgendaActivity.findById(activity!._id))!;expect(saved.fieldState).toBe('completed_offline');expect(saved.completedAt!.valueOf()).toBe(report.receivedAt.valueOf());expect((await fieldVisitService.detail(s1.context,company,String(activity!._id))).offlineReport!.notes).toBe(operation.notes);
  expect((await request(app).post(base()+'/sync').set(headers(s1)).send({grantId:snapshot.grantId,operation:{...operation,operationId:randomUUID()}})).status).toBe(409);await expect(agendaService.update(s1.context,company,'party',String(activity!._id),{version:saved.version,status:'pendente'})).rejects.toThrow();
 },30000);
 it('rejects reports overlapping an online attendance even after that attendance is interrupted',async()=>{
  const first=await fixture('Online ativo',true),second=await fixture('Offline conflitante',true),online=await fieldVisitService.checkIn(s1.context,company,String(first.activity!._id),{version:0,position:point,locationAuthorized:true}),at=new Date();
  const operation={kind:'visit',operationId:randomUUID(),partyId:second.party.id,partyVersion:0,activityId:String(second.activity!._id),activityVersion:0,capturedAt:at.toISOString(),observedInAt:online.execution.checkedInAt,observedOutAt:at.toISOString(),checkIn:point,checkOut:point,locationAuthorized:true,outcome:'realizada',notes:'Relato sobreposto',nextSteps:''};
  expect((await request(app).post(base()+'/sync').set(headers(s1)).send({grantId:second.snapshot.grantId,operation})).status).toBe(409);await fieldVisitService.interrupt(s1.context,company,String(first.activity!._id),{version:0,reason:'Encerrando atendimento online aberto'});expect((await request(app).post(base()+'/sync').set(headers(s1)).send({grantId:second.snapshot.grantId,operation})).status).toBe(409);expect(await OfflineVisitReport.countDocuments({activityId:second.activity!._id})).toBe(0);
 },30000);
 it('imports an unplanned visit once and creates its own completed agenda occurrence',async()=>{
  const {party,snapshot}=await fixture('Sem agendamento'),at=new Date(),operation={kind:'visit',operationId:randomUUID(),partyId:party.id,partyVersion:0,capturedAt:at.toISOString(),observedInAt:new Date(at.valueOf()-1).toISOString(),observedOutAt:at.toISOString(),checkIn:point,checkOut:point,locationAuthorized:true,outcome:'contato_ausente',notes:'Tentativa sem agenda',nextSteps:''},body={grantId:snapshot.grantId,operation};const results=await Promise.all([1,2].map(()=>request(app).post(base()+'/sync').set(headers(s1)).send(body)));expect(results.map(row=>row.status)).toEqual([200,200]);expect(await AgendaActivity.countDocuments({partyId:party.id})).toBe(1);const row=(await AgendaActivity.findOne({partyId:party.id}))!;expect(row.fieldState).toBe('completed_offline');expect((await OfflineVisitReport.findOne({partyId:party.id}))!.activityId.toString()).toBe(String(row._id));
 },30000);
 it('rolls back receipts, agenda and immutable audit together',async()=>{
  const {party,snapshot}=await fixture('Rollback'),operation=task(party.id),spy=vi.spyOn(OfflineAudit,'create').mockRejectedValueOnce(Error('audit unavailable'));try{await expect(offlineService.sync(s1.context,company,{grantId:snapshot.grantId,operation})).rejects.toThrow('audit unavailable');}finally{spy.mockRestore();}expect(await OfflineReceipt.countDocuments({operationId:operation.operationId})).toBe(0);expect(await AgendaActivity.countDocuments({partyId:party.id})).toBe(0);
 },30000);
 it('rejects transferred portfolios, other users grants, old sessions and expired upload windows',async()=>{
  const {party,snapshot}=await fixture('Transferir'),operation=task(party.id);await relationshipService.update(a.context,company,'lead',party.id,{version:0,ownerId:s2.context.userId});expect((await request(app).post(base()+'/sync').set(headers(s1)).send({grantId:snapshot.grantId,operation})).status).toBe(404);expect((await request(app).post(base()+'/sync').set(headers(s2)).send({grantId:snapshot.grantId,operation:{...operation,partyVersion:1}})).status).toBe(404);
  const own=await fixture('Retomar'),body={grantId:own.snapshot.grantId,operation:task(own.party.id)},old=s1;s1=(await identityService.login('offline-seller-one@example.invalid',password))!;expect((await request(app).post(base()+'/sync').set(headers(old)).send(body)).status).toBe(401);expect((await request(app).post(base()+'/sync').set(headers(s1)).send(body)).status).toBe(200);
  await OfflineGrant.collection.updateOne({_id:new mongoose.Types.ObjectId(own.snapshot.grantId)},{$set:{uploadUntil:new Date(Date.now()-1000)}});expect((await request(app).post(base()+'/sync').set(headers(s1)).send({...body,operation:{...body.operation,operationId:randomUUID()}})).body.code).toBe('OFFLINE_UPLOAD_EXPIRED');
 },30000);
 it('enforces the trial and bounded snapshot size on reconnect',async()=>{
  const {party,snapshot}=await fixture('Trial');await Tenant.updateOne({_id:a.context.tenantId},{$set:{'subscription.mode':'trial','subscription.trialEndsAt':new Date(Date.now()-1000)}});try{expect((await request(app).post(base()+'/sync').set(headers(s1)).send({grantId:snapshot.grantId,operation:task(party.id)})).status).toBe(401);}finally{await Tenant.updateOne({_id:a.context.tenantId},{$set:{'subscription.mode':'paid'}});}
  await Party.insertMany(Array.from({length:501},(_,i)=>({tenantId:a.context.tenantId,companyId:company,ownerId:a.context.userId,kind:'lead',name:'Cap '+i,address:{country:'Brasil'}})));const response=await request(app).post(base()+'/prepare').set(headers(a)).send({ownerId:a.context.userId});expect(response.body.code).toBe('OFFLINE_SCOPE_TOO_LARGE');
 },30000);
});


