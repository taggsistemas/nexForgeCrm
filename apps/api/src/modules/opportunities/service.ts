import {auditActorNames,auditActorLabel} from '../../infrastructure/audit-actors.js';
import mongoose from 'mongoose';
import type {AccessContext,Permission} from '../../../../../packages/contracts/src/index.js';
import type {OpportunityView,OpportunityActivityView} from '../../../../../packages/contracts/src/opportunities.js';
import {companyScope} from '../../infrastructure/access.js';
import {commercialFilter} from '../identity/profile-access.js';
import {Party} from '../relationships/models.js';
import {objectId} from '../relationships/input.js';
import {assertLeadQualified} from '../relationships/qualification.js';
import {RecordNotFound,RecordConflict} from '../relationships/service.js';
import {Opportunity,OpportunityActivity,OpportunityHistory} from './models.js';
import {createOpportunityInput,updateOpportunityInput,opportunityListInput,pageInput,createActivityInput,updateActivityInput} from './input.js';
export class OpportunityRuleRejected extends Error {}
const literal=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const scope=(context:AccessContext,companyId:string,permission:Permission)=>{const value=companyScope(context,companyId,permission);commercialFilter(context,companyId,permission);return value;};
function allowedKinds(context:AccessContext){const kinds:string[]=[];if(context.permissions.includes('lead:read'))kinds.push('lead');if(context.permissions.includes('customer:read'))kinds.push('customer');return kinds;}
function parentFilter(context:AccessContext,companyId:string,permission:Permission,extra:Record<string,unknown>={}){
 return commercialFilter(context,companyId,permission,{kind:{$in:allowedKinds(context)},archived:false,...extra});
}
const idScope=(context:AccessContext,companyId:string,permission:Permission)=>{const value=scope(context,companyId,permission);return {tenantId:new mongoose.Types.ObjectId(value.tenantId),companyId:new mongoose.Types.ObjectId(value.companyId)};};
async function parent(context:AccessContext,companyId:string,id:string,permission:Permission,session?:mongoose.ClientSession){
 objectId.parse(id);const query=Party.findOne(parentFilter(context,companyId,permission,{_id:id}));if(session)query.session(session);const row=await query;if(!row)throw new RecordNotFound();return row;
}
export async function authorizeOpportunity(context:AccessContext,companyId:string,id:string,permission:Permission,session?:mongoose.ClientSession){
 objectId.parse(id);const query=Opportunity.findOne({...scope(context,companyId,permission),_id:id});if(session)query.session(session);const row=await query;if(!row)throw new RecordNotFound();
 const party=await parent(context,companyId,String(row.partyId),permission,session);return {row,party};
}
function view(row:InstanceType<typeof Opportunity>,party:InstanceType<typeof Party>):OpportunityView{return {id:String(row._id),partyId:String(row.partyId),partyName:party.name,ownerId:String(party.ownerId),title:row.title,amountCents:row.amountCents,currency:'BRL',expectedCloseDate:row.expectedCloseDate,stage:row.stage,lossReason:row.lossReason,notes:row.notes,closedAt:row.closedAt?.toISOString()??null,version:row.version,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()};}
function activityView(row:InstanceType<typeof OpportunityActivity>):OpportunityActivityView{return {id:String(row._id),opportunityId:String(row.opportunityId),title:row.title,type:row.type,status:row.status,dueAt:row.dueAt.toISOString(),completedAt:row.completedAt?.toISOString()??null,notes:row.notes,version:row.version,...(row.seriesId?{seriesId:String(row.seriesId)}:{})};}
async function history(context:AccessContext,companyId:string,id:unknown,entityId:unknown,action:string,session:mongoose.ClientSession,transition?:{previousStage:string;nextStage:string}){
 await OpportunityHistory.create([{tenantId:context.tenantId,companyId,opportunityId:id,actorId:context.userId,entityId,action,...transition}],{session});
}
async function touch(party:InstanceType<typeof Party>,context:AccessContext,companyId:string,session:mongoose.ClientSession){await Party.updateOne({_id:party._id,tenantId:context.tenantId,companyId,archived:false},{$inc:{commercialRevision:1}},{session});}
const transaction=<T>(operation:(session:mongoose.ClientSession)=>Promise<T>)=>mongoose.connection.transaction(operation);
export const opportunityService={
 async detail(context:AccessContext,companyId:string,id:string){const {row,party}=await authorizeOpportunity(context,companyId,id,'pipeline:read');return {record:view(row,party)};},
 async references(context:AccessContext,companyId:string,raw:unknown){
  const input=opportunityListInput.parse(raw);scope(context,companyId,'pipeline:write');
  const items=await Party.find(parentFilter(context,companyId,'pipeline:write',{$or:[{kind:'customer'},{kind:'lead',stage:'qualificado'}],...(input.search?{name:{$regex:literal(input.search),$options:'i'}}:{})})).sort({name:1,_id:1}).limit(30);
  return {items:items.map(row=>({id:String(row._id),name:row.name,kind:row.kind}))};
 },
 async list(context:AccessContext,companyId:string,raw:unknown){
  const input=opportunityListInput.parse(raw),match=idScope(context,companyId,'pipeline:read');
  const parentQuery=Party.find(parentFilter(context,companyId,'pipeline:read'));parentQuery.cast(Party);const converted=parentQuery.getFilter();
  const result=await Opportunity.aggregate([
   {$match:{...match,...(input.stage?{stage:input.stage}:{}),...(input.search?{title:{$regex:literal(input.search),$options:'i'}}:{})}},
   {$lookup:{from:Party.collection.name,localField:'partyId',foreignField:'_id',pipeline:[{$match:converted},{$project:{name:1,ownerId:1}}],as:'party'}},{$unwind:'$party'},
   {$sort:{createdAt:-1,_id:-1}},{$facet:{total:[{$count:'count'}],items:[{$skip:(input.page-1)*20},{$limit:20}]}}
  ]);
  const page=result[0];return {items:page.items.map((row:Record<string,unknown>)=>view(Opportunity.hydrate(row),Party.hydrate(row.party))),total:page.total[0]?.count??0,page:input.page,pageSize:20};
 },
 async create(context:AccessContext,companyId:string,raw:unknown){
  const input=createOpportunityInput.parse(raw),company=scope(context,companyId,'pipeline:write');
  return transaction(async session=>{
   const party=await parent(context,companyId,input.partyId,'pipeline:write',session);if(party.kind==='lead')assertLeadQualified(party.toObject());
   await touch(party,context,companyId,session);
   const [row]=await Opportunity.create([{...input,...company}],{session});await history(context,companyId,row._id,row._id,'opportunity.created',session);return view(row,party);
  });
 },
 async update(context:AccessContext,companyId:string,id:string,raw:unknown){
  const parsed=updateOpportunityInput.parse(raw),{version}=parsed;const changes=Object.fromEntries(Object.entries(parsed).filter(([key])=>key!=='version'&&Object.hasOwn(raw as object,key)));
  return transaction(async session=>{
   const {row,party}=await authorizeOpportunity(context,companyId,id,'pipeline:write',session);
   if(row.version!==version)throw new RecordConflict();if(['ganha','perdida'].includes(row.stage))throw new OpportunityRuleRejected();
   const next={...row.toObject(),...changes};if(next.stage==='perdida'&&!next.lossReason?.trim())throw new OpportunityRuleRejected();
   if(next.stage!=='perdida'&&changes.lossReason)throw new OpportunityRuleRejected();
   await touch(party,context,companyId,session);
   const updated=await Opportunity.findOneAndUpdate({...scope(context,companyId,'pipeline:write'),_id:id,version},{$set:{...changes,lossReason:next.stage==='perdida'?next.lossReason:'',closedAt:['ganha','perdida'].includes(next.stage)?new Date():null},$inc:{version:1}},{new:true,session,runValidators:true});
   if(!updated)throw new RecordConflict();
   await history(context,companyId,id,id,row.stage===updated.stage?'opportunity.updated':'opportunity.stage_changed',session,row.stage===updated.stage?undefined:{previousStage:row.stage,nextStage:updated.stage});return view(updated,party);
  });
 },
 async activities(context:AccessContext,companyId:string,id:string,raw:unknown){
  scope(context,companyId,'activity:read');await authorizeOpportunity(context,companyId,id,'pipeline:read');const input=pageInput.parse(raw),filter={...scope(context,companyId,'activity:read'),opportunityId:id};
  const [rows,total]=await Promise.all([OpportunityActivity.find(filter).sort({dueAt:1,_id:1}).skip((input.page-1)*20).limit(20),OpportunityActivity.countDocuments(filter)]);
  return {items:rows.map(activityView),total,page:input.page,pageSize:20};
 },
 async createActivity(context:AccessContext,companyId:string,id:string,raw:unknown){
  const input=createActivityInput.parse(raw),company=scope(context,companyId,'activity:write');
  return transaction(async session=>{
   const {row,party}=await authorizeOpportunity(context,companyId,id,'pipeline:read',session);if(['ganha','perdida'].includes(row.stage))throw new OpportunityRuleRejected();
   await touch(party,context,companyId,session);
   // Conflict with a concurrent closure, not just a concurrent parent transfer.
   await Opportunity.updateOne({_id:row._id,...company},{$inc:{activityRevision:1}},{session});
   const [activity]=await OpportunityActivity.create([{...input,...company,opportunityId:row._id}],{session});await history(context,companyId,id,activity._id,'activity.created',session);return activityView(activity);
  });
 },
 async updateActivity(context:AccessContext,companyId:string,id:string,activityId:string,raw:unknown){
  objectId.parse(activityId);const input=updateActivityInput.parse(raw),{version}=input,changes=Object.fromEntries(Object.entries(input).filter(([key])=>key!=='version'&&Object.hasOwn(raw as object,key)));
  scope(context,companyId,'activity:write');
  return transaction(async session=>{
   const {party}=await authorizeOpportunity(context,companyId,id,'pipeline:read',session);await touch(party,context,companyId,session);
   const filter={...scope(context,companyId,'activity:write'),opportunityId:id,_id:activityId};
   const old=await OpportunityActivity.findOne(filter).session(session);if(!old)throw new RecordNotFound();if(old.version!==version)throw new RecordConflict();
   const nextStatus=changes.status??old.status;
   const row=await OpportunityActivity.findOneAndUpdate({...filter,version},{$set:{...changes,completedAt:nextStatus==='concluida'?(old.completedAt??new Date()):null},$inc:{version:1}},{new:true,session,runValidators:true});
   if(!row)throw new RecordConflict();await history(context,companyId,id,row._id,'activity.updated',session);return activityView(row);
  });
 },
 async history(context:AccessContext,companyId:string,id:string,raw:unknown){
  await authorizeOpportunity(context,companyId,id,'pipeline:read');const input=pageInput.parse(raw),filter={...scope(context,companyId,'pipeline:read'),opportunityId:id};
  const [rows,total]=await Promise.all([OpportunityHistory.find(filter).sort({createdAt:-1,_id:-1}).skip((input.page-1)*20).limit(20),OpportunityHistory.countDocuments(filter)]);
  const actors=await auditActorNames(context.tenantId,rows.map(row=>String(row.actorId)));
  return {items:rows.map(row=>({id:String(row._id),action:row.action,actorName:auditActorLabel(actors,String(row.actorId),context.userId),previousStage:row.previousStage,nextStage:row.nextStage,createdAt:row.createdAt.toISOString()})),total,page:input.page,pageSize:20};
 }
};
