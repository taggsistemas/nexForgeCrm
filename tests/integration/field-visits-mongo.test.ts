import {seedRelationship} from '../fixtures/relationships.js';
import {territoryCatalog} from '../../apps/api/src/modules/territories/catalog.js';
import {visitPlanning} from '../../apps/api/src/modules/territories/planning.js';
import {initializeTerritoryModels} from '../../apps/api/src/modules/territories/models.js';
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
import {initializeRelationshipModels,Party} from '../../apps/api/src/modules/relationships/models.js';
import {initializeAccountSecurityModels} from '../../apps/api/src/modules/account-security/models.js';
import {initializeAgendaModels,AgendaActivity} from '../../apps/api/src/modules/agenda/models.js';
import {agendaService} from '../../apps/api/src/modules/agenda/service.js';
import {initializeFieldVisitModels,FieldExecution,FieldVisitAudit} from '../../apps/api/src/modules/field-visits/models.js';
import {fieldVisitService} from '../../apps/api/src/modules/field-visits/service.js';
import {customerRegistrationFixture} from '../fixtures/customer.js';
import {prepareAccount} from '../fixtures/ready-account.js';
type Login=NonNullable<Awaited<ReturnType<typeof identityService.login>>>;
const uri=process.env.MONGODB_TEST_URI,database='nexforge_crm_test_'+randomUUID().replaceAll('-',''),origin='http://localhost:5173',zone='America/Sao_Paulo';
let a:Login,b:Login,s1:Login,s2:Login,supervisor:Login,company:string;
const app=createApp({origin,databaseReady:()=>true,identity:identityService}),headers=(login:Login)=>({Origin:origin,Cookie:'nf_session='+login.token}),base=()=>'/api/v1/companies/'+company+'/field-visits';
const position={latitude:-25.39,longitude:-51.46,accuracy:15},checkIn={version:0,position,locationAuthorized:true},checkOut={version:0,position,locationAuthorized:true,outcome:'realizada',notes:'Apresentação concluída',nextSteps:'Preparar proposta'};
async function visit(name:string){const party=await seedRelationship(s1.context,company,'lead',{name});await agendaService.create(s1.context,company,{link:{source:'party',id:party.id},title:'Visita '+name,type:'visita',startLocal:'2030-01-02T09:00',timeZone:zone});return {party,activity:(await AgendaActivity.findOne({partyId:party.id}))!};}
describe.skipIf(!uri)('field visits: persisted execution, live authorization and transactional locks',()=>{
 beforeAll(async()=>{
  await mongoose.connect(uri!,{dbName:database,serverSelectionTimeoutMS:10000});
  await Promise.all([initializeClientModels(),initializeRelationshipModels(),initializeAccountSecurityModels(),initializeAgendaModels(),initializeFieldVisitModels(),initializeTerritoryModels(),AdministrationAudit.init(),PlatformAdmin.init()]);
  const password='field-test-password',master=await PlatformAdmin.create({name:'Master',email:'field-master@example.invalid',passwordHash:await hashPassword(password)});
  const tenant=async(name:string)=>{const c=await platformClients.create({...customerRegistrationFixture,name,slug:name,companyName:name,adminName:name,adminEmail:name+'@example.invalid',adminPassword:password},String(master._id));await prepareAccount(c.admin!.email);return (await identityService.login(c.admin!.email,password))!;};
  a=await tenant('field-a');b=await tenant('field-b');company=a.context.companyIds[0]!;
  const seller=async(name:string)=>{const user=await administrationService.create(a.context,{name,email:name+'@example.invalid',password,profileKey:'seller',companyIds:[company]});await prepareAccount(user.email);return (await identityService.login(user.email,password))!;};
  s1=await seller('field-seller-one');s2=await seller('field-seller-two');
  const user=await administrationService.create(a.context,{name:'Supervisor',email:'field-supervisor@example.invalid',password,profileKey:'supervisor',companyIds:[company],supervisedUserIds:[s1.context.userId]});await prepareAccount(user.email);supervisor=(await identityService.login(user.email,password))!;
 },90000);
 afterAll(async()=>{try{if(mongoose.connection.name===database)await mongoose.connection.dropDatabase();}finally{await mongoose.disconnect();}});
 it('filters before pagination and enforces tenant, owner, origin and strict input',async()=>{
  const {activity}=await visit('Scope');const id=String(activity._id),path=base()+'/activities/'+id;
  const daily=await request(app).get(base()+'/daily').query({date:'2030-01-02',timeZone:zone}).set(headers(s1));expect(daily.status).toBe(200);expect(daily.body.total).toBe(1);expect(daily.body.items[0].canExecute).toBe(true);
  expect((await fieldVisitService.daily(s2.context,company,{date:'2030-01-02',timeZone:zone})).total).toBe(0);
  expect((await fieldVisitService.daily(supervisor.context,company,{date:'2030-01-02',timeZone:zone})).total).toBe(1);
  expect((await request(app).get(path).set(headers(b))).status).toBe(403);
  expect((await request(app).get(path).set(headers(s2))).status).toBe(404);
  expect((await request(app).post(path+'/check-in').set(headers(supervisor)).send(checkIn)).status).toBe(403);
  expect((await request(app).post(path+'/check-in').set('Cookie','nf_session='+s1.token).send(checkIn)).status).toBe(403);
  for(const extra of [{tenantId:b.context.tenantId},{checkedInAt:'2000-01-01'},{locationAuthorized:false},{position:{...position,latitude:91}}])expect((await request(app).post(path+'/check-in').set(headers(s1)).send({...checkIn,...extra})).status).toBe(400);
 },30000);
 it('serializes simultaneous check-ins, locks agenda edits and closes atomically with a server timestamp',async()=>{
  const {party,activity}=await visit('Execution'),second=await visit('Second'),id=String(activity._id);
  const results=await Promise.all([fieldVisitService.checkIn(s1.context,company,id,checkIn),fieldVisitService.checkIn(s1.context,company,String(second.activity._id),checkIn)].map(p=>p.then(()=>201,error=>(error.constructor.name==='RecordConflict'?409:500))));expect(results.sort()).toEqual([201,409]);
  const active=(await FieldExecution.findOne({actorId:s1.context.userId,state:'in_progress'}))!,activeId=String(active.activityId);
  expect((await request(app).patch('/api/v1/companies/'+company+'/agenda/activities/party/'+activeId).set(headers(s1)).send({version:1,status:'concluida'})).status).toBe(400);
  const client=(await Party.findById(active.partyId))!;await expect(relationshipService.archive(s1.context,company,'lead',String(client._id),{version:client.version})).rejects.toThrow();expect((await Party.findById(client._id))!.archived).toBe(false);
  const out=await request(app).post(base()+'/activities/'+activeId+'/check-out').set(headers(s1)).send(checkOut);expect(out.status).toBe(200);expect(out.body.execution.state).toBe('completed');expect(out.body.execution.outcome).toBe('realizada');expect(Date.now()-Date.parse(out.body.execution.checkedOutAt)).toBeLessThan(10000);
  const saved=(await AgendaActivity.findById(activeId))!;expect(saved.status).toBe('concluida');expect(saved.fieldState).toBe('completed');expect(saved.completedAt!.toISOString()).toBe(out.body.execution.checkedOutAt);
  expect((await request(app).post(base()+'/activities/'+activeId+'/check-out').set(headers(s1)).send(checkOut)).status).toBe(409);
  expect(await FieldVisitAudit.countDocuments({activityId:activeId})).toBe(2);
  // A completed field record cannot be rewritten through ordinary agenda editing.
  await expect(agendaService.update(s1.context,company,'party',activeId,{version:saved.version,status:'pendente'})).rejects.toThrow();
 },30000);
 it('protects published plans and recurring series from cancelling a live attendance',async()=>{
  const book=await territoryCatalog.savePortfolio(a.context,company,null,{name:'Field portfolio',ownerId:s1.context.userId}),party=await seedRelationship(s1.context,company,'customer',{name:'Published visit'});
  await territoryCatalog.transfer(a.context,company,{portfolioId:book.id,entries:[{partyId:party.id,version:0}]});
  const plan=await visitPlanning.create(s1.context,company,{title:'Field Plan',portfolioId:book.id,period:'monthly',anchorDate:'2030-01-02',timeZone:zone});
  await visitPlanning.saveItem(s1.context,company,plan.id,null,{partyId:party.id,startLocal:'2030-01-02T09:00',durationMinutes:30,objective:'Demonstrar produto'});
  let detail=await visitPlanning.detail(s1.context,company,plan.id,{});await visitPlanning.action(s1.context,company,plan.id,'publish',{version:detail.record.version});
  const activity=(await AgendaActivity.findOne({visitPlanId:plan.id}))!;await fieldVisitService.checkIn(s1.context,company,String(activity._id),checkIn);
  detail=await visitPlanning.detail(s1.context,company,plan.id,{});await expect(visitPlanning.action(s1.context,company,plan.id,'cancel',{version:detail.record.version})).rejects.toThrow();
  await fieldVisitService.checkOut(s1.context,company,String(activity._id),checkOut);await expect(visitPlanning.action(s1.context,company,plan.id,'complete',{version:detail.record.version})).resolves.toEqual({count:0});
  const recurring=await agendaService.create(s1.context,company,{link:{source:'party',id:party.id},title:'Recurring field',type:'visita',startLocal:'2030-02-01T09:00',timeZone:zone,recurrence:{frequency:'daily',interval:1,count:2}});
  const first=(await AgendaActivity.findOne({seriesId:recurring.series!.id}).sort({dueAt:1}))!;await fieldVisitService.checkIn(s1.context,company,String(first._id),checkIn);
  await expect(agendaService.cancelSeries(s1.context,company,recurring.series!.id,{version:0})).rejects.toThrow();
  await fieldVisitService.interrupt(s1.context,company,String(first._id),{version:0,reason:'Atendimento interrompido pelo vendedor'});
 },30000);
 it('rolls back check-in and its activity lock when the immutable audit cannot be written',async()=>{
  const {activity}=await visit('Rollback'),id=String(activity._id),spy=vi.spyOn(FieldVisitAudit,'create').mockRejectedValueOnce(Error('audit unavailable'));
  try{await expect(fieldVisitService.checkIn(s1.context,company,id,checkIn)).rejects.toThrow('audit unavailable');}finally{spy.mockRestore();}
  expect(await FieldExecution.countDocuments({activityId:id})).toBe(0);expect((await AgendaActivity.findById(id))!.fieldState).toBe('none');expect((await AgendaActivity.findById(id))!.version).toBe(0);
 },30000);
 it('immediately revokes the former owner after transfer and permits a justified managerial interruption',async()=>{
  const {party,activity}=await visit('Transfer'),id=String(activity._id);await fieldVisitService.checkIn(s1.context,company,id,checkIn);
  await relationshipService.update(a.context,company,'lead',party.id,{version:0,ownerId:s2.context.userId});
  expect((await request(app).post(base()+'/activities/'+id+'/check-out').set(headers(s1)).send(checkOut)).status).toBe(404);
  expect((await request(app).post(base()+'/activities/'+id+'/check-out').set(headers(s2)).send(checkOut)).status).toBe(403);
  expect((await request(app).get(base()+'/activities/'+id).set(headers(supervisor))).status).toBe(404);
  const interrupted=await fieldVisitService.interrupt(a.context,company,id,{version:0,reason:'Carteira transferida durante o atendimento'});expect(interrupted.execution.state).toBe('interrupted');expect(interrupted.execution.checkOut).toBeNull();expect((await AgendaActivity.findById(id))!.status).toBe('cancelada');
  const newVisit=await visit('After interruption');await expect(fieldVisitService.checkIn(s1.context,company,String(newVisit.activity._id),checkIn)).resolves.toHaveProperty('execution.state','in_progress');await fieldVisitService.interrupt(s1.context,company,String(newVisit.activity._id),{version:0,reason:'Encerramento de teste sem localização'});
 },30000);
});




