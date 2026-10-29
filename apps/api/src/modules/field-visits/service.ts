import {TechnicalWork} from '../technical/models.js';
import {OfflineVisitReport} from '../offline/models.js';
import {offlineReportView} from '../offline/service.js';
import mongoose from 'mongoose';
import type {AccessContext,Permission} from '../../../../../packages/contracts/src/index.js';
import type {FieldExecutionView,FieldStopView} from '../../../../../packages/contracts/src/field-visits.js';
import {addCalendarDays} from '../../../../../packages/contracts/src/agenda.js';
import {companyScope,AccessDenied} from '../../infrastructure/access.js';
import {commercialFilter} from '../identity/profile-access.js';
import {Party,Property} from '../relationships/models.js';
import {locationNames} from '../relationships/locations.js';
import {User} from '../identity/models.js';
import {RecordNotFound,RecordConflict} from '../relationships/service.js';
import {objectId} from '../relationships/input.js';
import {AgendaActivity,AgendaAudit} from '../agenda/models.js';
import {dayBoundary} from '../agenda/recurrence.js';
import {VisitPlan} from '../territories/models.js';
import {FieldExecution,FieldVisitAudit} from './models.js';
import {dailyRouteInput,checkInInput,checkOutInput,interruptInput,FieldVisitRuleRejected} from './input.js';
const scope=(ctx:AccessContext,company:string,permission:Permission)=>{commercialFilter(ctx,company,permission);return companyScope(ctx,company,permission);};
function partyFilter(ctx:AccessContext,company:string,permission:Permission,extra:Record<string,unknown>={}){
 const kinds:string[]=[];if(ctx.permissions.includes('lead:read'))kinds.push('lead');if(ctx.permissions.includes('customer:read'))kinds.push('customer');
 return commercialFilter(ctx,company,permission,{archived:false,kind:{$in:kinds},...extra});
}
async function load(ctx:AccessContext,company:string,id:string,permission:Permission,session?:mongoose.ClientSession){
 objectId.parse(id);const activity=await AgendaActivity.findOne({...scope(ctx,company,permission),_id:id,type:'visita'}).session(session??null);if(!activity)throw new RecordNotFound();
 const party=await Party.findOne(partyFilter(ctx,company,permission,{_id:activity.partyId})).session(session??null);if(!party)throw new RecordNotFound();return {activity,party};
}
function executionView(row:InstanceType<typeof FieldExecution>):FieldExecutionView{
 const position=(value:{latitude:number;longitude:number;accuracy:number})=>({latitude:value.latitude,longitude:value.longitude,accuracy:value.accuracy});
 return {id:String(row._id),state:row.state,actorId:String(row.actorId),version:row.version,checkedInAt:row.checkedInAt.toISOString(),checkedOutAt:row.checkedOutAt?.toISOString()??null,checkIn:position(row.checkIn),checkOut:row.checkOut?position(row.checkOut):null,outcome:row.outcome??null,notes:row.notes,nextSteps:row.nextSteps,interruptionReason:row.interruptionReason};
}
async function mutate<T>(fn:(session:mongoose.ClientSession)=>Promise<T>){try{return await mongoose.connection.transaction(fn);}catch(error){if((error as {code?:number}).code===11000)throw new RecordConflict();throw error;}}
async function touch(ctx:AccessContext,company:string,activity:InstanceType<typeof AgendaActivity>,party:InstanceType<typeof Party>,session:mongoose.ClientSession){
 const companyScope=scope(ctx,company,'visit:write');
 await User.updateOne({_id:ctx.userId,active:true},{$inc:{fieldRevision:1}},{session});
 await Party.updateOne({_id:party._id,...companyScope},{$inc:{commercialRevision:1}},{session});
 if(activity.visitPlanId){const plan=await VisitPlan.findOne({_id:activity.visitPlanId,...companyScope}).session(session);if(!plan||plan.state!=='published')throw new FieldVisitRuleRejected();await VisitPlan.updateOne({_id:plan._id,...companyScope},{$inc:{agendaRevision:1}},{session});}
}
async function audit(ctx:AccessContext,company:string,activityId:unknown,executionId:unknown,action:string,session:mongoose.ClientSession){await FieldVisitAudit.create([{...scope(ctx,company,'visit:write'),actorId:ctx.userId,activityId,executionId,action}],{session});}
export const fieldVisitService={
 async daily(ctx:AccessContext,company:string,raw:unknown){
  const input=dailyRouteInput.parse(raw),companyScope=scope(ctx,company,'visit:read');
  const parent=Party.find(partyFilter(ctx,company,'visit:read',input.ownerId?{ownerId:input.ownerId}:{}));parent.cast(Party);
  const ids={tenantId:new mongoose.Types.ObjectId(companyScope.tenantId),companyId:new mongoose.Types.ObjectId(company)};
  const [result]=await AgendaActivity.aggregate([
   {$match:{...ids,type:'visita',dueAt:{$gte:dayBoundary(input.date,input.timeZone),$lt:dayBoundary(addCalendarDays(input.date,1),input.timeZone)}}},
   {$lookup:{from:Party.collection.name,localField:'partyId',foreignField:'_id',pipeline:[{$match:parent.getFilter()}],as:'party'}},{$unwind:'$party'},...(input.regionId?[{$lookup:{from:Property.collection.name,localField:'propertyId',foreignField:'_id',pipeline:[{$match:{...ids,regionId:new mongoose.Types.ObjectId(input.regionId)}},{$project:{_id:1}}],as:'territory'}},{$unwind:'$territory'}]:[]),{$sort:{dueAt:1,_id:1}},
   {$facet:{total:[{$count:'count'}],items:[{$skip:(input.page-1)*50},{$limit:50},{$lookup:{from:User.collection.name,localField:'party.ownerId',foreignField:'_id',pipeline:[{$project:{name:1}}],as:'owner'}},{$lookup:{from:FieldExecution.collection.name,localField:'_id',foreignField:'activityId',pipeline:[{$match:ids}],as:'execution'}},{$lookup:{from:OfflineVisitReport.collection.name,localField:'_id',foreignField:'activityId',pipeline:[{$match:ids}],as:'offlineReport'}}]}}
  ]);
  const names=await locationNames(ctx,company,result.items.map((row:any)=>({propertyId:row.propertyId,equipmentId:row.equipmentId})));
  const items:FieldStopView[]=result.items.map((row:any):FieldStopView=>{const property=row.propertyId?names.property.get(String(row.propertyId)):undefined;return ({...(row.offlineReport[0]?{offlineReport:offlineReportView(OfflineVisitReport.hydrate(row.offlineReport[0]))}:{}),canExecute:String(row.party.ownerId)===ctx.userId&&(!row.execution[0]||String(row.execution[0].actorId)===ctx.userId),canInterrupt:ctx.permissions.includes('portfolio:manage')||String(row.execution[0]?.actorId)===ctx.userId,id:String(row._id),partyId:String(row.party._id),partyName:row.party.name,ownerId:String(row.party.ownerId),ownerName:row.owner[0]?.name??'Responsável',title:row.title,dueAt:row.dueAt.toISOString(),status:row.status,version:row.version,address:property?.address||Object.values(row.party.address??{}).filter(value=>typeof value==='string'&&value).join(', '),propertyName:property?.name??'',regionName:property?.regionName??'',equipmentName:row.equipmentId?names.equipment.get(String(row.equipmentId))??'':'',objective:row.objective||(row.visitPlanItemId?row.notes:'')||'',execution:row.execution[0]?executionView(FieldExecution.hydrate(row.execution[0])):null});});
  return {date:input.date,timeZone:input.timeZone,order:'scheduled' as const,total:Number(result.total[0]?.count??0),page:input.page,pageSize:50,items};
 },
 async detail(ctx:AccessContext,company:string,id:string){
  await load(ctx,company,id,'visit:read');const row=await FieldExecution.findOne({...scope(ctx,company,'visit:read'),activityId:id});const report=await OfflineVisitReport.findOne({...scope(ctx,company,'visit:read'),activityId:id});return {execution:row?executionView(row):null,offlineReport:report?offlineReportView(report):null};
 },
 async checkIn(ctx:AccessContext,company:string,id:string,raw:unknown){
  const input=checkInInput.parse(raw);scope(ctx,company,'activity:write');
  return mutate(async session=>{
   const {activity,party}=await load(ctx,company,id,'visit:write',session);
   if(String(party.ownerId)!==ctx.userId)throw new AccessDenied();
   if(activity.version!==input.version)throw new RecordConflict();
   if(activity.status!=='pendente'||activity.fieldState!=='none')throw new FieldVisitRuleRejected();
   await touch(ctx,company,activity,party,session);
   if(await TechnicalWork.exists({technicianId:ctx.userId,state:'in_progress'}).session(session))throw new RecordConflict();
   if(await OfflineVisitReport.exists({userId:ctx.userId,observedInAt:{$lte:new Date()},observedOutAt:{$gt:new Date()}}).session(session))throw new FieldVisitRuleRejected();
   const [row]=await FieldExecution.create([{...scope(ctx,company,'visit:write'),activityId:id,partyId:party._id,actorId:ctx.userId,locationNoticeVersion:'1.0',state:'in_progress',checkedInAt:new Date(),checkIn:input.position}],{session});
   const changed=await AgendaActivity.updateOne({_id:id,...scope(ctx,company,'activity:write'),version:input.version,status:'pendente'},{$set:{fieldState:'in_progress'},$inc:{version:1}},{session});if(changed.modifiedCount!==1)throw new RecordConflict();
   await audit(ctx,company,id,row!._id,'visit.checkin',session);return {execution:executionView(row!)};
  });
 },
 async checkOut(ctx:AccessContext,company:string,id:string,raw:unknown){
  const input=checkOutInput.parse(raw);scope(ctx,company,'activity:write');
  return mutate(async session=>{
   const {activity,party}=await load(ctx,company,id,'visit:write',session),row=await FieldExecution.findOne({...scope(ctx,company,'visit:write'),activityId:id}).session(session);
   if(!row)throw new RecordNotFound();if(String(party.ownerId)!==ctx.userId||String(row.actorId)!==ctx.userId)throw new AccessDenied();
   if(row.version!==input.version)throw new RecordConflict();if(row.state!=='in_progress'||activity.fieldState!=='in_progress'||activity.status!=='pendente')throw new FieldVisitRuleRejected();
   await touch(ctx,company,activity,party,session);const now=new Date();
   row.state='completed';row.checkedOutAt=now;row.checkOut=input.position;row.outcome=input.outcome;row.notes=input.notes;row.nextSteps=input.nextSteps;row.version++;await row.save({session});
   await AgendaActivity.updateOne({_id:id,...scope(ctx,company,'activity:write'),version:activity.version},{$set:{fieldState:'completed',status:'concluida',completedAt:now},$inc:{version:1}},{session});
   await AgendaAudit.create([{...scope(ctx,company,'activity:write'),actorId:ctx.userId,entityId:id,source:'party',action:'agenda.activity.updated'}],{session});
   await audit(ctx,company,id,row._id,'visit.checkout',session);return {execution:executionView(row)};
  });
 },
 async interrupt(ctx:AccessContext,company:string,id:string,raw:unknown){
  const input=interruptInput.parse(raw);scope(ctx,company,'activity:write');
  return mutate(async session=>{
   const {activity,party}=await load(ctx,company,id,'visit:write',session),row=await FieldExecution.findOne({...scope(ctx,company,'visit:write'),activityId:id}).session(session);
   if(!row)throw new RecordNotFound();if(String(row.actorId)!==ctx.userId&&!ctx.permissions.includes('portfolio:manage'))throw new AccessDenied();
   if(row.version!==input.version)throw new RecordConflict();if(row.state!=='in_progress')throw new FieldVisitRuleRejected();
   await touch(ctx,company,activity,party,session);row.state='interrupted';row.interruptionReason=input.reason;row.checkedOutAt=new Date();row.version++;await row.save({session});
   await AgendaActivity.updateOne({_id:id,...scope(ctx,company,'activity:write'),version:activity.version},{$set:{fieldState:'interrupted',status:'cancelada',completedAt:null},$inc:{version:1}},{session});
   await audit(ctx,company,id,row._id,'visit.interrupted',session);return {execution:executionView(row)};
  });
 }
};






