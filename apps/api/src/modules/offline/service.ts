import {TechnicalWork} from '../technical/models.js';
import mongoose from 'mongoose';
import {createHash} from 'node:crypto';
import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import type {OfflineSnapshot,OfflineVisitReportView} from '../../../../../packages/contracts/src/offline.js';
import {companyScope,AccessDenied} from '../../infrastructure/access.js';
import {commercialFilter} from '../identity/profile-access.js';
import {Party,Contact} from '../relationships/models.js';
import {RecordNotFound} from '../relationships/service.js';
import {User,Tenant,Company,Session} from '../identity/models.js';
import {tokenHash} from '../identity/security.js';
import {AgendaActivity,AgendaAudit} from '../agenda/models.js';
import {FieldExecution} from '../field-visits/models.js';
import {VisitPlan} from '../territories/models.js';
import {OfflineGrant,OfflineReceipt,OfflineVisitReport,OfflineAudit} from './models.js';
import {prepareInput,syncInput,OfflineConflict,OfflineRejected} from './input.js';
const ids=(context:AccessContext,company:string)=>companyScope(context,company,'activity:read');
function partyFilter(context:AccessContext,company:string,permission:'activity:read'|'activity:write',extra:Record<string,unknown>={}){const kinds:string[]=[];if(context.permissions.includes('lead:read'))kinds.push('lead');if(context.permissions.includes('customer:read'))kinds.push('customer');return commercialFilter(context,company,permission,{archived:false,kind:{$in:kinds},...extra});}
export function offlineReportView(row:InstanceType<typeof OfflineVisitReport>):OfflineVisitReportView{return {observedInAt:row.observedInAt.toISOString(),observedOutAt:row.observedOutAt.toISOString(),receivedAt:row.receivedAt.toISOString(),outcome:row.outcome as OfflineVisitReportView['outcome'],notes:row.notes,nextSteps:row.nextSteps??'',checkIn:{latitude:row.checkIn.latitude!,longitude:row.checkIn.longitude!,accuracy:row.checkIn.accuracy!},checkOut:{latitude:row.checkOut.latitude!,longitude:row.checkOut.longitude!,accuracy:row.checkOut.accuracy!}};}
export const offlineService={
 async prepare(context:AccessContext,company:string,raw:unknown,sessionToken:string):Promise<OfflineSnapshot>{
  const input=prepareInput.parse(raw),scope=ids(context,company);commercialFilter(context,company,'activity:write');
  return mongoose.connection.transaction(async session=>{
   const auth=await Session.findOne({tenantId:context.tenantId,userId:context.userId,_id:context.userId,tokenHash:tokenHash(sessionToken),expiresAt:{$gt:new Date()}}).session(session);if(!auth)throw new AccessDenied();
   const tenant=await Tenant.findOne({_id:context.tenantId,active:true}).session(session);if(!tenant)throw new AccessDenied();
   const issuedAt=new Date(),expiresAt=new Date(Math.min(issuedAt.valueOf()+8*3600000,auth.expiresAt.valueOf(),tenant.subscription.mode==='trial'?(tenant.subscription.trialEndsAt?.valueOf()??0):Infinity));if(expiresAt<=issuedAt)throw new AccessDenied();
   const parties=await Party.find(partyFilter(context,company,'activity:read',input.ownerId?{ownerId:input.ownerId}:{})).sort({name:1,_id:1}).limit(501).session(session);if(parties.length>500)throw new OfflineRejected('OFFLINE_SCOPE_TOO_LARGE');
   const linked=parties.map(row=>row._id),activities=await AgendaActivity.find({...scope,partyId:{$in:linked},dueAt:{$gte:new Date(issuedAt.valueOf()-30*86400000),$lte:new Date(issuedAt.valueOf()+30*86400000)}}).sort({dueAt:1,_id:1}).limit(1001).session(session);
   const contacts=context.permissions.includes('contact:read')?await Contact.find({...scope,partyId:{$in:linked},archived:false}).limit(1001).session(session):[];if(activities.length>1000||contacts.length>1000)throw new OfflineRejected('OFFLINE_SCOPE_TOO_LARGE');
   const user=await User.findById(context.userId).select('name').session(session),organization=await Company.findOne({_id:company,tenantId:context.tenantId,active:true}).select('name').session(session);if(!user||!organization)throw new AccessDenied();
   const uploadUntil=new Date(issuedAt.valueOf()+7*86400000),[grant]=await OfflineGrant.create([{...scope,userId:context.userId,issuedAt,expiresAt,uploadUntil,purgeAt:new Date(uploadUntil.valueOf()+30*86400000)}],{session});
   return {capabilities:{activityWrite:context.permissions.includes('activity:write'),visitWrite:context.permissions.includes('activity:write')&&context.permissions.includes('visit:write')},grantId:String(grant!._id),issuedAt:issuedAt.toISOString(),expiresAt:expiresAt.toISOString(),uploadUntil:uploadUntil.toISOString(),identity:{userId:context.userId,tenantId:context.tenantId,companyId:company,userName:user.name,companyName:organization.name},parties:parties.map(row=>({id:String(row._id),name:row.name,kind:row.kind,contactName:row.contactName??'',phone:row.phone,email:row.email,address:Object.values(row.toObject().address).filter(value=>typeof value==='string'&&value).join(', '),ownerId:String(row.ownerId),version:row.version})),contacts:contacts.map(row=>({id:String(row._id),partyId:String(row.partyId),name:row.name,phone:row.phone,email:row.email,position:row.position})),activities:activities.map(row=>({id:String(row._id),partyId:String(row.partyId),title:row.title,type:row.type,status:row.status,dueAt:row.dueAt.toISOString(),version:row.version,fieldState:row.fieldState}))};
  });
 },
 async sync(context:AccessContext,company:string,raw:unknown){
  const {grantId,operation}=syncInput.parse(raw),scope=companyScope(context,company,'activity:write'),hash=createHash('sha256').update(JSON.stringify(operation)).digest('hex');
  const execute=()=>mongoose.connection.transaction(async session=>{
   const grant=await OfflineGrant.findOne({_id:grantId,...scope,userId:context.userId}).session(session);if(!grant)throw new RecordNotFound();if(new Date()>grant.uploadUntil)throw new OfflineRejected('OFFLINE_UPLOAD_EXPIRED');
   const party=await Party.findOne(partyFilter(context,company,'activity:write',{_id:operation.partyId})).session(session);if(!party)throw new RecordNotFound();
   const key={...scope,userId:context.userId,operationId:operation.operationId},previous=await OfflineReceipt.findOne(key).session(session);
   if(previous){if(previous.payloadHash!==hash)throw new OfflineRejected('OFFLINE_IDEMPOTENCY_MISMATCH');return {operationId:operation.operationId,entityId:String(previous.entityId),replayed:true};}
   const receivedAt=new Date(),within=(date:string)=>Date.parse(date)>=grant.issuedAt.valueOf()-60000&&Date.parse(date)<=Math.min(grant.expiresAt.valueOf(),receivedAt.valueOf()+60000);
   if(!within(operation.capturedAt)||operation.kind==='visit'&&(!within(operation.observedInAt)||!within(operation.observedOutAt)))throw new OfflineRejected('OFFLINE_CAPTURE_OUTSIDE_LEASE');
   if(party.version!==operation.partyVersion)throw new OfflineConflict();
   await Party.updateOne({_id:party._id,...scope},{$inc:{commercialRevision:1}},{session});
   const [receipt]=await OfflineReceipt.create([{...key,grantId,partyId:party._id,payloadHash:hash,kind:operation.kind,purgeAt:grant.purgeAt}],{session});
   let entityId:mongoose.Types.ObjectId,agendaId:mongoose.Types.ObjectId;
   if(operation.kind==='activity'){
    const dueAt=new Date(operation.dueAt);if(dueAt<new Date('1900-01-01')||dueAt>new Date('2101-01-01'))throw new OfflineRejected('OFFLINE_INVALID_DATE');
    const [row]=await AgendaActivity.create([{...scope,partyId:party._id,title:operation.title,type:operation.type,dueAt,notes:operation.notes,offlineCapturedAt:new Date(operation.capturedAt),offlineOperationId:operation.operationId}],{session});entityId=row!._id;agendaId=entityId;
   }else{
    companyScope(context,company,'visit:write');if(String(party.ownerId)!==context.userId)throw new AccessDenied();
    const activity=operation.activityId?await AgendaActivity.findOne({_id:operation.activityId,...scope,partyId:party._id,type:'visita'}).session(session):(await AgendaActivity.create([{...scope,partyId:party._id,title:('Visita offline - '+party.name).slice(0,160),type:'visita',dueAt:new Date(operation.observedInAt),offlineCapturedAt:new Date(operation.capturedAt),offlineOperationId:operation.operationId}],{session}))[0];if(!activity)throw new RecordNotFound();if(operation.activityId&&activity.version!==operation.activityVersion||activity.status!=='pendente'||activity.fieldState!=='none')throw new OfflineConflict();
    await User.updateOne({_id:context.userId,active:true},{$inc:{fieldRevision:1}},{session});
    if(await TechnicalWork.exists({technicianId:context.userId,$or:[{state:'in_progress'},{checkedInAt:{$lt:new Date(operation.observedOutAt)},$or:[{checkedOutAt:{$gt:new Date(operation.observedInAt)}},{interruptedAt:{$gt:new Date(operation.observedInAt)}}]}]}).session(session))throw new OfflineConflict();
     if(await FieldExecution.exists({actorId:context.userId,$or:[{state:'in_progress'},{checkedInAt:{$lt:new Date(operation.observedOutAt)},checkedOutAt:{$gt:new Date(operation.observedInAt)}}]}).session(session)||await OfflineVisitReport.exists({userId:context.userId,observedInAt:{$lt:new Date(operation.observedOutAt)},observedOutAt:{$gt:new Date(operation.observedInAt)}}).session(session))throw new OfflineConflict();
    // Serialize distinct offline imports and online check-in by touching the executor's membership.
    const {Membership}=await import('../identity/models.js');await Membership.updateOne({tenantId:context.tenantId,userId:context.userId,active:true},{$inc:{commercialRevision:1}},{session});
    if(activity.visitPlanId){const plan=await VisitPlan.findOne({_id:activity.visitPlanId,...scope,state:'published'}).session(session);if(!plan)throw new OfflineConflict();await VisitPlan.updateOne({_id:plan._id,...scope},{$inc:{agendaRevision:1}},{session});}
    const [report]=await OfflineVisitReport.create([{...scope,userId:context.userId,activityId:activity._id,partyId:party._id,operationId:operation.operationId,observedInAt:new Date(operation.observedInAt),observedOutAt:new Date(operation.observedOutAt),receivedAt,checkIn:operation.checkIn,checkOut:operation.checkOut,outcome:operation.outcome,notes:operation.notes,nextSteps:operation.nextSteps,locationNoticeVersion:'offline-1.0'}],{session});entityId=report!._id;agendaId=activity._id;
    await AgendaActivity.updateOne({_id:activity._id,...scope,version:activity.version},{$set:{status:'concluida',fieldState:'completed_offline',completedAt:receivedAt},$inc:{version:1}},{session});
   }
   await OfflineReceipt.updateOne({_id:receipt!._id},{$set:{entityId}},{session});
   await OfflineAudit.create([{...scope,userId:context.userId,partyId:party._id,operationId:operation.operationId,action:operation.kind==='visit'?'offline.visit.applied':'offline.activity.applied',entityId}],{session});
   await AgendaAudit.create([{...scope,actorId:context.userId,entityId:agendaId,source:'party',action:operation.kind==='visit'&&operation.activityId?'agenda.activity.updated':'agenda.activity.created'}],{session});return {operationId:operation.operationId,entityId:String(entityId),replayed:false};
  });
  try{return await execute();}catch(error){if((error as {code?:number}).code===11000)return execute();throw error;}
 }
};







