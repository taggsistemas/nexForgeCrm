import mongoose from 'mongoose';
import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import type {VisitPlanView,VisitPlanItemView} from '../../../../../packages/contracts/src/territories.js';
import {visitPlanRange} from '../../../../../packages/contracts/src/territories.js';
import {commercialFilter} from '../identity/profile-access.js';
import {User} from '../identity/models.js';
import {Party} from '../relationships/models.js';
import {RecordConflict,RecordNotFound} from '../relationships/service.js';
import {objectId} from '../relationships/input.js';
import {AgendaActivity,AgendaAudit} from '../agenda/models.js';
import {wallTimeToInstant,dayBoundary} from '../agenda/recurrence.js';
import {Portfolio,VisitPlan,VisitPlanItem} from './models.js';
import {createPlanInput,updatePlanInput,createPlanItemInput,updatePlanItemInput,planActionInput,territoryListInput} from './input.js';
import {scope,literal,portfolio,party,partyFilter,plan,seller,region,audit,transact} from './shared.js';
import {TerritoryRuleRejected} from './errors.js';
async function planView(row:InstanceType<typeof VisitPlan>):Promise<VisitPlanView>{
 const [book,owner]=await Promise.all([Portfolio.findOne({_id:row.portfolioId,tenantId:row.tenantId,companyId:row.companyId}),User.findById(row.ownerId).select('name')]);
 return {id:String(row._id),title:row.title,portfolioId:String(row.portfolioId),portfolioName:book?.name??'',ownerId:String(row.ownerId),ownerName:owner?.name??'Vendedor indisponível',period:row.period,startDate:row.startDate,endDate:row.endDate,timeZone:row.timeZone,state:row.state,notes:row.notes,version:row.version};
}
async function touchPlan(row:InstanceType<typeof VisitPlan>,context:AccessContext,companyId:string,session:mongoose.ClientSession){
 const result=await VisitPlan.updateOne({...scope(context,companyId,'visit:write'),_id:row._id,state:'draft',version:row.version},{$inc:{version:1}},{session});if(result.modifiedCount!==1)throw new RecordConflict();
}
async function validateAssignment(row:InstanceType<typeof VisitPlan>,context:AccessContext,companyId:string,partyId:string,session:mongoose.ClientSession){
 const record=await party(context,companyId,partyId,'visit:write',session);
 if(String(record.portfolioId)!==String(row.portfolioId)||String(record.ownerId)!==String(row.ownerId))throw new TerritoryRuleRejected();
 await Party.updateOne({_id:record._id,...scope(context,companyId,'visit:write')},{$inc:{commercialRevision:1}},{session});return record;
}
async function activeBook(row:InstanceType<typeof VisitPlan>,context:AccessContext,companyId:string,session:mongoose.ClientSession){
 const book=await portfolio(context,companyId,String(row.portfolioId),'visit:write',session,true);
 if(String(book.ownerId)!==String(row.ownerId))throw new TerritoryRuleRejected();await seller(context,companyId,String(row.ownerId),session,true);await region(context,companyId,book.regionId?String(book.regionId):null,session);
 await Portfolio.updateOne({_id:book._id,...scope(context,companyId,'visit:write')},{$inc:{referenceRevision:1}},{session});
}
function schedule(row:InstanceType<typeof VisitPlan>,input:{startLocal:string;durationMinutes:number}){
 const startAt=wallTimeToInstant(input.startLocal,row.timeZone),endAt=new Date(startAt.valueOf()+input.durationMinutes*60000);
 if(startAt<dayBoundary(row.startDate,row.timeZone)||endAt>dayBoundary(row.endDate,row.timeZone))throw new TerritoryRuleRejected();return {startAt,endAt};
}
export const visitPlanning={
 async list(context:AccessContext,companyId:string,raw:unknown){
  const input=territoryListInput.parse(raw);
  const books=input.regionId?await Portfolio.find(commercialFilter(context,companyId,'portfolio:read',{regionId:input.regionId})).select('_id'):null;
  const filter=commercialFilter(context,companyId,'visit:read',{...(input.search?{title:{$regex:literal(input.search),$options:'i'}}:{}),...(input.state?{state:input.state}:{}),...(books?{portfolioId:{$in:books.map(row=>row._id)}}:input.portfolioId&&input.portfolioId!=='none'?{portfolioId:input.portfolioId}:{})});
  const [rows,total]=await Promise.all([VisitPlan.find(filter).sort({startDate:-1,_id:-1}).skip((input.page-1)*20).limit(20),VisitPlan.countDocuments(filter)]);
  return {items:await Promise.all(rows.map(planView)),total,page:input.page,pageSize:20};
 },
 async detail(context:AccessContext,companyId:string,id:string,raw:unknown){
  const row=await plan(context,companyId,id,'visit:read'),input=territoryListInput.parse(raw),company=scope(context,companyId,'visit:read');
  if(row.state!=='draft')scope(context,companyId,'activity:read');
  const parent=Party.find(partyFilter(context,companyId,'visit:read'));parent.cast(Party);
  const [result]=await VisitPlanItem.aggregate([{$match:{tenantId:new mongoose.Types.ObjectId(company.tenantId),companyId:new mongoose.Types.ObjectId(companyId),planId:row._id}},{$lookup:{from:Party.collection.name,localField:'partyId',foreignField:'_id',pipeline:[{$match:parent.getFilter()}],as:'party'}},{$unwind:'$party'},{$sort:{startAt:1,_id:1}},{$facet:{total:[{$count:'count'}],items:[{$skip:(input.page-1)*20},{$limit:20},{$lookup:{from:AgendaActivity.collection.name,localField:'_id',foreignField:'visitPlanItemId',pipeline:[{$match:{tenantId:new mongoose.Types.ObjectId(company.tenantId),companyId:new mongoose.Types.ObjectId(companyId),visitPlanId:row._id}}],as:'activities'}}]}}]);
  const items:VisitPlanItemView[]=result.items.map((item:{_id:unknown;partyId:unknown;party:{name:string;ownerId:unknown;portfolioId:unknown};startAt:Date;endAt:Date;durationMinutes:number;objective:string;version:number;activities:{_id:unknown;dueAt:Date;status:string}[]})=>{
   const activity=item.activities[0],startAt=activity?.dueAt??item.startAt;
   return {id:String(item._id),partyId:String(item.partyId),partyName:item.party.name,ownerId:String(item.party.ownerId),startAt:startAt.toISOString(),endAt:new Date(startAt.valueOf()+item.durationMinutes*60000).toISOString(),durationMinutes:item.durationMinutes,objective:item.objective,version:item.version,activityId:activity?String(activity._id):null,activityStatus:activity?.status??'draft',validAssignment:String(item.party.portfolioId)===String(row.portfolioId)&&String(item.party.ownerId)===String(row.ownerId)};
  });
  return {record:await planView(row),items,total:result.total[0]?.count??0,page:input.page,pageSize:20};
 },
 async create(context:AccessContext,companyId:string,raw:unknown){
  const input=createPlanInput.parse(raw),company=scope(context,companyId,'visit:write');
  return transact(async session=>{
   const book=await portfolio(context,companyId,input.portfolioId,'visit:write',session,true);
   await seller(context,companyId,String(book.ownerId),session,true);await region(context,companyId,book.regionId?String(book.regionId):null,session);
   await Portfolio.updateOne({_id:book._id,...company},{$inc:{referenceRevision:1}},{session});
   const {anchorDate,...fields}=input;
   const [row]=await VisitPlan.create([{...fields,...company,ownerId:book.ownerId,...visitPlanRange(anchorDate,input.period)}],{session});
   await audit(context,companyId,row._id,'visitplan.created',session);return {id:String(row._id)};
  });
 },
 async update(context:AccessContext,companyId:string,id:string,raw:unknown){
  const {version,...fields}=updatePlanInput.parse(raw);
  return transact(async session=>{
   const row=await plan(context,companyId,id,'visit:write',session);if(row.version!==version)throw new RecordConflict();if(row.state!=='draft')throw new TerritoryRuleRejected();
   await VisitPlan.updateOne({_id:row._id,...scope(context,companyId,'visit:write'),version},{$set:fields,$inc:{version:1}},{session});
   await audit(context,companyId,id,'visitplan.updated',session);return {id};
  });
 },
 async saveItem(context:AccessContext,companyId:string,id:string,itemId:string|null,raw:unknown){
  const input=itemId?updatePlanItemInput.parse(raw):createPlanItemInput.parse(raw);if(itemId)objectId.parse(itemId);
  return transact(async session=>{
   const row=await plan(context,companyId,id,'visit:write',session);if(row.state!=='draft')throw new TerritoryRuleRejected();await activeBook(row,context,companyId,session);
   const old=itemId?await VisitPlanItem.findOne({_id:itemId,planId:id,...scope(context,companyId,'visit:write')}).session(session):null;
   if(itemId&&!old)throw new RecordNotFound();if(old&&old.version!==updatePlanItemInput.parse(raw).version)throw new RecordConflict();
   const record=await validateAssignment(row,context,companyId,old?String(old.partyId):createPlanItemInput.parse(raw).partyId,session),times=schedule(row,input);
   const overlapping=await VisitPlanItem.exists({...scope(context,companyId,'visit:write'),planId:id,...(old?{_id:{$ne:old._id}}:{}),startAt:{$lt:times.endAt},endAt:{$gt:times.startAt}}).session(session);if(overlapping)throw new TerritoryRuleRejected();
   if(!old&&await VisitPlanItem.countDocuments({planId:id,...scope(context,companyId,'visit:write')}).session(session)>=50)throw new TerritoryRuleRejected();
   await touchPlan(row,context,companyId,session);
   const fields={...times,durationMinutes:input.durationMinutes,objective:input.objective};
   const saved=old?await VisitPlanItem.findOneAndUpdate({_id:old._id,planId:id,...scope(context,companyId,'visit:write'),version:old.version},{$set:fields,$inc:{version:1}},{new:true,session,runValidators:true}):(await VisitPlanItem.create([{...fields,...scope(context,companyId,'visit:write'),planId:id,partyId:record._id}],{session}))[0];
   if(!saved)throw new RecordConflict();await audit(context,companyId,saved._id,old?'visitplan.item.updated':'visitplan.item.created',session);return {id:String(saved._id)};
  });
 },
 async removeItem(context:AccessContext,companyId:string,id:string,itemId:string,raw:unknown){
  objectId.parse(itemId);const {version}=planActionInput.parse(raw);
  return transact(async session=>{
   const row=await plan(context,companyId,id,'visit:write',session);if(row.state!=='draft')throw new TerritoryRuleRejected();
   const item=await VisitPlanItem.findOne({_id:itemId,planId:id,...scope(context,companyId,'visit:write')}).session(session);if(!item)throw new RecordNotFound();if(item.version!==version)throw new RecordConflict();
   await party(context,companyId,String(item.partyId),'visit:write',session);await touchPlan(row,context,companyId,session);
   await VisitPlanItem.deleteOne({_id:item._id,version,...scope(context,companyId,'visit:write')},{session});await audit(context,companyId,item._id,'visitplan.item.removed',session);return {id:itemId};
  });
 },
 async action(context:AccessContext,companyId:string,id:string,action:'publish'|'cancel'|'complete',raw:unknown){
  const {version}=planActionInput.parse(raw),company=scope(context,companyId,'visit:write');
  return transact(async session=>{
   const row=await plan(context,companyId,id,'visit:write',session);if(row.version!==version)throw new RecordConflict();
   if(action==='publish'&&row.state!=='draft'||action==='cancel'&&!['draft','published'].includes(row.state)||action==='complete'&&row.state!=='published')throw new TerritoryRuleRejected();
   const items=await VisitPlanItem.find({...company,planId:id}).sort({startAt:1}).session(session);
   let count=0;
   if(action==='publish'){
    scope(context,companyId,'activity:write');await activeBook(row,context,companyId,session);
    if(!items.length||items.length>50)throw new TerritoryRuleRejected();
    const records=[];
    for(const item of items){
     const client=await validateAssignment(row,context,companyId,String(item.partyId),session);
     records.push({...company,partyId:client._id,title:('Visita — '+client.name).slice(0,160),type:'visita',dueAt:item.startAt,notes:item.objective,objective:item.objective.slice(0,500),visitPlanId:row._id,visitPlanItemId:item._id,durationMinutes:item.durationMinutes});
    }
    const activities=await AgendaActivity.create(records,{session,ordered:true});count=activities.length;
    await AgendaAudit.insertMany(activities.map(activity=>({...company,actorId:context.userId,entityId:activity._id,source:'party',action:'agenda.activity.created'})),{session});
   }else if(row.state==='published'){
    scope(context,companyId,action==='cancel'?'activity:write':'activity:read');
    // Revalidate every linked party: a former seller cannot cancel a transferred client's calendar.
    for(const item of items){const client=await party(context,companyId,String(item.partyId),'visit:write',session);await Party.updateOne({_id:client._id,...company},{$inc:{commercialRevision:1}},{session});}
    const filter={...company,visitPlanId:row._id};
    if(action==='cancel'&&await AgendaActivity.exists({...filter,fieldState:'in_progress'}).session(session))throw new TerritoryRuleRejected();
    if(action==='complete'){
     const activities=await AgendaActivity.find(filter).session(session);
     if(activities.length!==items.length||activities.some(activity=>activity.status==='pendente'))throw new TerritoryRuleRejected();
    }else{
     const pending={...filter,status:'pendente',dueAt:{$gte:new Date()}},activities=await AgendaActivity.find(pending).session(session);
     if(activities.some(activity=>activity.fieldState==='in_progress'))throw new TerritoryRuleRejected();
     count=(await AgendaActivity.updateMany(pending,{$set:{status:'cancelada',completedAt:null},$inc:{version:1}},{session})).modifiedCount;
     if(activities.length)await AgendaAudit.insertMany(activities.map(activity=>({...company,actorId:context.userId,entityId:activity._id,source:'party',action:'agenda.activity.updated'})),{session});
    }
   }
   const state=action==='publish'?'published':action==='cancel'?'cancelled':'completed',timestamp=action==='publish'?'publishedAt':action==='cancel'?'cancelledAt':'completedAt';
   const result=await VisitPlan.updateOne({_id:row._id,...company,version},{$set:{state,[timestamp]:new Date()},$inc:{version:1}},{session});if(result.modifiedCount!==1)throw new RecordConflict();
   await audit(context,companyId,id,action==='publish'?'visitplan.published':action==='cancel'?'visitplan.cancelled':'visitplan.completed',session,{affectedCount:count});return {count};
  });
 }
};
