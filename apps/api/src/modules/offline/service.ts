import {TechnicalWork} from '../technical/models.js';
import mongoose from 'mongoose';
import {createHash} from 'node:crypto';
import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import type {OfflineProduct,OfflineSnapshot,OfflineSyncResult,OfflineVisitReportView} from '../../../../../packages/contracts/src/offline.js';
import {companyScope,AccessDenied} from '../../infrastructure/access.js';
import {commercialFilter} from '../identity/profile-access.js';
import {Party,Contact,Property,Equipment} from '../relationships/models.js';
import {InvalidReference,RecordNotFound} from '../relationships/service.js';
import {CatalogProduct,PriceTable} from '../catalog/models.js';
import {createDirectOrder,submitOrderIn} from '../orders/service.js';
import {OrderRuleRejected} from '../orders/input.js';
import {SalesOrder} from '../orders/models.js';
import {openTicket} from '../tickets/service.js';
import {Ticket} from '../tickets/models.js';
import {dateParts} from '../../../../../packages/contracts/src/agenda.js';
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
/** Active catalog with the company's general price table (valid today) as a suggestion; the customer's table is applied on sync. */
async function offlineProducts(scope:{tenantId:string;companyId:string},session:mongoose.ClientSession):Promise<OfflineProduct[]>{
 const rows=await CatalogProduct.find({...scope,active:true}).select('code description kind unit quantityDecimals').sort({description:1}).limit(2001).session(session);if(rows.length>2000)throw new OfflineRejected('OFFLINE_SCOPE_TOO_LARGE');
 const today=dateParts(new Date(),'America/Sao_Paulo').date,tables=await PriceTable.find({...scope,scope:'global',active:true}).session(session);
 const table=tables.find(row=>(!row.validFrom||row.validFrom<=today)&&(!row.validUntil||row.validUntil>=today)),prices=new Map((table?.entries??[]).map(entry=>[String(entry.productId),entry.priceCents]));
 return rows.map(row=>({id:String(row._id),code:row.code,description:row.description,kind:row.kind as 'product'|'service',unit:row.unit,quantityDecimals:row.quantityDecimals,priceCents:prices.get(String(row._id))??null}));
}
/** Number (and order status) of an already applied order/ticket, so a replay answers like the first reply. */
async function entityNumber(kind:string,id:unknown,session:mongoose.ClientSession):Promise<{number?:string;status?:string}>{
 if(kind==='order'){const row=await SalesOrder.findById(id).select('number status').session(session);return row?{number:row.number,status:row.status}:{};}
 if(kind==='ticket'){const row=await Ticket.findById(id).select('number').session(session);return row?{number:row.number}:{};}
 return {};
}
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
   const properties=await Property.find({...scope,partyId:{$in:linked},archived:false}).select('partyId name').sort({name:1}).limit(2001).session(session);
   const equipment=context.permissions.includes('ticket:write')?await Equipment.find({...scope,partyId:{$in:linked},archived:false}).select('partyId propertyId brand model serialNumber').limit(3001).session(session):[];
   if(properties.length>2000||equipment.length>3000)throw new OfflineRejected('OFFLINE_SCOPE_TOO_LARGE');
   const products=context.permissions.includes('order:write')&&context.permissions.includes('catalog:read')?await offlineProducts(scope,session):[];
   const user=await User.findById(context.userId).select('name').session(session),organization=await Company.findOne({_id:company,tenantId:context.tenantId,active:true}).select('name').session(session);if(!user||!organization)throw new AccessDenied();
   const uploadUntil=new Date(issuedAt.valueOf()+7*86400000),[grant]=await OfflineGrant.create([{...scope,userId:context.userId,issuedAt,expiresAt,uploadUntil,purgeAt:new Date(uploadUntil.valueOf()+30*86400000)}],{session});
   return {capabilities:{activityWrite:context.permissions.includes('activity:write'),visitWrite:context.permissions.includes('activity:write')&&context.permissions.includes('visit:write'),orderWrite:context.permissions.includes('order:write')&&context.permissions.includes('order:sales')&&products.length>0,ticketWrite:context.permissions.includes('ticket:write')},grantId:String(grant!._id),issuedAt:issuedAt.toISOString(),expiresAt:expiresAt.toISOString(),uploadUntil:uploadUntil.toISOString(),identity:{userId:context.userId,tenantId:context.tenantId,companyId:company,userName:user.name,companyName:organization.name},parties:parties.map(row=>({id:String(row._id),name:row.name,kind:row.kind,contactName:row.contactName??'',phone:row.phone,email:row.email,address:Object.values(row.toObject().address).filter(value=>typeof value==='string'&&value).join(', '),ownerId:String(row.ownerId),version:row.version,orderable:row.kind==='customer'&&row.qualificationState==='approved'})),properties:properties.map(row=>({id:String(row._id),partyId:String(row.partyId),name:row.name})),equipment:equipment.map(row=>({id:String(row._id),partyId:String(row.partyId),propertyId:String(row.propertyId),name:[row.brand,row.model,row.serialNumber].filter(Boolean).join(' · ')||'Equipamento'})),products,contacts:contacts.map(row=>({id:String(row._id),partyId:String(row.partyId),name:row.name,phone:row.phone,email:row.email,position:row.position})),activities:activities.map(row=>({id:String(row._id),partyId:String(row.partyId),title:row.title,type:row.type,status:row.status,dueAt:row.dueAt.toISOString(),version:row.version,fieldState:row.fieldState}))};
  });
 },
 async sync(context:AccessContext,company:string,raw:unknown){
  const {grantId,operation}=syncInput.parse(raw),scope=companyScope(context,company,'activity:write'),hash=createHash('sha256').update(JSON.stringify(operation)).digest('hex');
  if(operation.kind==='order')companyScope(context,company,'order:write');if(operation.kind==='ticket')companyScope(context,company,'ticket:write');
  const execute=()=>mongoose.connection.transaction(async (session):Promise<OfflineSyncResult>=>{
   const grant=await OfflineGrant.findOne({_id:grantId,...scope,userId:context.userId}).session(session);if(!grant)throw new RecordNotFound();if(new Date()>grant.uploadUntil)throw new OfflineRejected('OFFLINE_UPLOAD_EXPIRED');
   const party=await Party.findOne(partyFilter(context,company,'activity:write',{_id:operation.partyId})).session(session);if(!party)throw new RecordNotFound();
   const key={...scope,userId:context.userId,operationId:operation.operationId},previous=await OfflineReceipt.findOne(key).session(session);
   if(previous){if(previous.payloadHash!==hash)throw new OfflineRejected('OFFLINE_IDEMPOTENCY_MISMATCH');return {operationId:operation.operationId,entityId:String(previous.entityId),replayed:true,...await entityNumber(previous.kind,previous.entityId,session)};}
   const receivedAt=new Date(),within=(date:string)=>Date.parse(date)>=grant.issuedAt.valueOf()-60000&&Date.parse(date)<=Math.min(grant.expiresAt.valueOf(),receivedAt.valueOf()+60000);
   if(!within(operation.capturedAt)||operation.kind==='visit'&&(!within(operation.observedInAt)||!within(operation.observedOutAt)))throw new OfflineRejected('OFFLINE_CAPTURE_OUTSIDE_LEASE');
   // Party version guards activities/visits; orders and tickets are re-evaluated by their own server rules.
   if((operation.kind==='activity'||operation.kind==='visit')&&party.version!==operation.partyVersion)throw new OfflineConflict();
   await Party.updateOne({_id:party._id,...scope},{$inc:{commercialRevision:1}},{session});
   const [receipt]=await OfflineReceipt.create([{...key,grantId,partyId:party._id,payloadHash:hash,kind:operation.kind,purgeAt:grant.purgeAt}],{session});
   let entityId:mongoose.Types.ObjectId,agendaId:mongoose.Types.ObjectId|null=null,extra:{number?:string;status?:string}={};
   if(operation.kind==='activity'){
    const dueAt=new Date(operation.dueAt);if(dueAt<new Date('1900-01-01')||dueAt>new Date('2101-01-01'))throw new OfflineRejected('OFFLINE_INVALID_DATE');
    const [row]=await AgendaActivity.create([{...scope,partyId:party._id,title:operation.title,type:operation.type,dueAt,notes:operation.notes,offlineCapturedAt:new Date(operation.capturedAt),offlineOperationId:operation.operationId}],{session});entityId=row!._id;agendaId=entityId;
   }else if(operation.kind==='order'){
    try{
     const row=await createDirectOrder(context,company,{partyId:operation.partyId,items:operation.items.map(item=>({...item,discountCents:item.discountCents??0})),expectedDeliveryDate:operation.expectedDeliveryDate,paymentMethod:operation.paymentMethod,paymentTermDays:operation.paymentTermDays,notes:operation.notes},session,'Registrado offline em '+new Date(operation.capturedAt).toISOString());
     if(operation.submit)await submitOrderIn(context,company,row,session);entityId=row._id;extra={number:row.number,status:row.status};
    }catch(error){if(error instanceof OrderRuleRejected)throw new OfflineRejected('ORDER_'+error.code);throw error;}
   }else if(operation.kind==='ticket'){
    try{const row=await openTicket(context,company,{partyId:operation.partyId,propertyId:operation.propertyId,equipmentId:operation.equipmentId,origin:'visita',criticality:operation.criticality,title:operation.title,description:operation.description,previousTicketId:null},session);entityId=row._id;extra={number:row.number};}
    catch(error){if(error instanceof InvalidReference||error instanceof RecordNotFound)throw new OfflineRejected('TICKET_INVALID_REFERENCE');throw error;}
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
   await OfflineAudit.create([{...scope,userId:context.userId,partyId:party._id,operationId:operation.operationId,action:'offline.'+operation.kind+'.applied',entityId}],{session});
   if(agendaId)await AgendaAudit.create([{...scope,actorId:context.userId,entityId:agendaId,source:'party',action:operation.kind==='visit'&&operation.activityId?'agenda.activity.updated':'agenda.activity.created'}],{session});return {operationId:operation.operationId,entityId:String(entityId),replayed:false,...extra};
  });
  try{return await execute();}catch(error){if((error as {code?:number}).code===11000)return execute();throw error;}
 }
};







