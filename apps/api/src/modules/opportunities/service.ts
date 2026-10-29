import {auditActorNames,auditActorLabel} from '../../infrastructure/audit-actors.js';
import mongoose from 'mongoose';
import type {AccessContext,Permission} from '../../../../../packages/contracts/src/index.js';
import {defaultPipelineStages,openOpportunityStages,weightedCents,type OpportunityView,type OpportunityActivityView,type PipelineSettingsView} from '../../../../../packages/contracts/src/opportunities.js';
import {companyScope} from '../../infrastructure/access.js';
import {commercialFilter} from '../identity/profile-access.js';
import {Equipment,Party,PartyListOption,Property} from '../relationships/models.js';
import {objectId} from '../relationships/input.js';
import {assertLeadQualified} from '../relationships/qualification.js';
import {RecordNotFound,RecordConflict,InvalidReference} from '../relationships/service.js';
import {Opportunity,OpportunityActivity,OpportunityHistory,PipelineSetting} from './models.js';
import {createOpportunityInput,updateOpportunityInput,opportunityListInput,pageInput,createActivityInput,updateActivityInput,pipelineSettingsInput} from './input.js';
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
/** Batch view: property and equipment names are read live and marked when archived. */
async function views(context:AccessContext,companyId:string,pairs:{row:InstanceType<typeof Opportunity>;party:InstanceType<typeof Party>}[]):Promise<OpportunityView[]>{
 const propertyIds=pairs.flatMap(({row})=>row.propertyId?[row.propertyId]:[]),equipmentIds=pairs.flatMap(({row})=>row.equipmentId?[row.equipmentId]:[]);
 const [properties,equipment]=await Promise.all([propertyIds.length?Property.find({tenantId:context.tenantId,companyId,_id:{$in:propertyIds}}).select('name archived'):[],equipmentIds.length?Equipment.find({tenantId:context.tenantId,companyId,_id:{$in:equipmentIds}}).select('brand model serialNumber archived'):[]]);
 const propertyNames=new Map(properties.map(item=>[String(item._id),item.name+(item.archived?' (arquivada)':'')])),equipmentNames=new Map(equipment.map(item=>[String(item._id),[item.brand,item.model,item.serialNumber&&'série '+item.serialNumber].filter(Boolean).join(' ')+(item.archived?' (arquivado)':'')]));
 return pairs.map(({row,party})=>({id:String(row._id),partyId:String(row.partyId),partyName:party.name,ownerId:String(party.ownerId),title:row.title,amountCents:row.amountCents,currency:'BRL',expectedCloseDate:row.expectedCloseDate,stage:row.stage,probability:row.probability,weightedAmountCents:weightedCents(row.amountCents,row.probability),originId:row.originId?String(row.originId):null,propertyId:row.propertyId?String(row.propertyId):null,propertyName:row.propertyId?propertyNames.get(String(row.propertyId))??'Propriedade indisponível':'',equipmentId:row.equipmentId?String(row.equipmentId):null,equipmentName:row.equipmentId?equipmentNames.get(String(row.equipmentId))??'Equipamento indisponível':'',lossReason:row.lossReason,notes:row.notes,closedAt:row.closedAt?.toISOString()??null,version:row.version,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()}));
}
const view=async(context:AccessContext,companyId:string,row:InstanceType<typeof Opportunity>,party:InstanceType<typeof Party>)=>(await views(context,companyId,[{row,party}]))[0]!;
export async function pipelineSettings(context:AccessContext,companyId:string,session?:mongoose.ClientSession):Promise<PipelineSettingsView>{
 const row=await PipelineSetting.findOne({tenantId:context.tenantId,companyId}).session(session??null);
 return {stages:openOpportunityStages.map(key=>{const saved=row?.stages.find(stage=>stage.key===key);return {key,label:saved?.label??defaultPipelineStages[key].label,probability:saved?.probability??defaultPipelineStages[key].probability};}),version:row?.version??0};
}
/**
 * Links must belong to the live parent: property and equipment of the same customer, equipment on the chosen property.
 * Unchanged links are kept even if archived later; new links must be active. Equipment alone implies its property.
 */
async function links(context:AccessContext,companyId:string,partyId:unknown,input:Record<string,unknown>,current:Record<string,unknown>,session:mongoose.ClientSession){
 const same=(key:string)=>Object.hasOwn(input,key)&&String(input[key]??'')===String(current[key]??'');
 if(input.originId&&!same('originId')&&!await PartyListOption.exists({_id:input.originId,tenantId:context.tenantId,companyId,kind:'origin',active:true}).session(session))throw new InvalidReference();
 if(input.equipmentId&&!same('equipmentId')){
  const item=await Equipment.findOne({_id:input.equipmentId,tenantId:context.tenantId,companyId,partyId,archived:false}).session(session);if(!item)throw new InvalidReference();
  if(!Object.hasOwn(input,'propertyId')||!input.propertyId)input.propertyId=String(item.propertyId);
  if(String(input.propertyId)!==String(item.propertyId))throw new InvalidReference();
 }
 if(input.propertyId&&!same('propertyId')&&!await Property.exists({_id:input.propertyId,tenantId:context.tenantId,companyId,partyId,archived:false}).session(session))throw new InvalidReference();
 const propertyId=Object.hasOwn(input,'propertyId')?input.propertyId:current.propertyId,equipmentId=Object.hasOwn(input,'equipmentId')?input.equipmentId:current.equipmentId;
 if(equipmentId&&!propertyId)throw new InvalidReference();
 if(equipmentId&&propertyId&&same('equipmentId')&&!same('propertyId')&&!await Equipment.exists({_id:equipmentId,tenantId:context.tenantId,companyId,partyId,propertyId}).session(session))throw new InvalidReference();
}
function activityView(row:InstanceType<typeof OpportunityActivity>):OpportunityActivityView{return {id:String(row._id),opportunityId:String(row.opportunityId),title:row.title,type:row.type,status:row.status,dueAt:row.dueAt.toISOString(),completedAt:row.completedAt?.toISOString()??null,notes:row.notes,version:row.version,...(row.seriesId?{seriesId:String(row.seriesId)}:{})};}
export async function history(context:AccessContext,companyId:string,id:unknown,entityId:unknown,action:string,session:mongoose.ClientSession,transition?:{previousStage:string;nextStage:string},detail=''){
 await OpportunityHistory.create([{tenantId:context.tenantId,companyId,opportunityId:id,actorId:context.userId,entityId,action,...transition,...(detail?{detail:detail.slice(0,300)}:{})}],{session});
}
export async function touch(party:InstanceType<typeof Party>,context:AccessContext,companyId:string,session:mongoose.ClientSession){await Party.updateOne({_id:party._id,tenantId:context.tenantId,companyId,archived:false},{$inc:{commercialRevision:1}},{session});}
const transaction=async<T>(operation:(session:mongoose.ClientSession)=>Promise<T>)=>{try{return await mongoose.connection.transaction(operation);}catch(error){if((error as {code?:number}).code===11000)throw new RecordConflict();throw error;}};
export const opportunityService={
 async detail(context:AccessContext,companyId:string,id:string){const {row,party}=await authorizeOpportunity(context,companyId,id,'pipeline:read');return {record:await view(context,companyId,row,party)};},
 async settings(context:AccessContext,companyId:string){scope(context,companyId,'pipeline:read');return pipelineSettings(context,companyId);},
 async saveSettings(context:AccessContext,companyId:string,raw:unknown){
  const input=pipelineSettingsInput.parse(raw),company=companyScope(context,companyId,'list:manage');
  return transaction(async session=>{
   const current=await PipelineSetting.findOne(company).session(session);if((current?.version??0)!==input.version)throw new RecordConflict();
   if(current){current.set({stages:input.stages,version:current.version+1});await current.save({session});}else await PipelineSetting.create([{...company,stages:input.stages,version:1}],{session});
   return pipelineSettings(context,companyId,session);
  });
 },
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
  const page=result[0];return {items:await views(context,companyId,page.items.map((row:Record<string,unknown>)=>({row:Opportunity.hydrate(row),party:Party.hydrate(row.party)}))),total:page.total[0]?.count??0,page:input.page,pageSize:20};
 },
 async create(context:AccessContext,companyId:string,raw:unknown){
  const input=createOpportunityInput.parse(raw),company=scope(context,companyId,'pipeline:write');
  return transaction(async session=>{
   const party=await parent(context,companyId,input.partyId,'pipeline:write',session);if(party.kind==='lead')assertLeadQualified(party.toObject());
   await touch(party,context,companyId,session);const fields:Record<string,unknown>={...input};await links(context,companyId,party._id,fields,{},session);
   const probability=input.probability??(await pipelineSettings(context,companyId,session)).stages.find(stage=>stage.key===input.stage)!.probability;
   const [row]=await Opportunity.create([{...fields,probability,...company}],{session});await history(context,companyId,row._id,row._id,'opportunity.created',session,undefined,'Probabilidade '+probability+'%');return view(context,companyId,row,party);
  });
 },
 async update(context:AccessContext,companyId:string,id:string,raw:unknown){
  const parsed=updateOpportunityInput.parse(raw),{version}=parsed;const changes=Object.fromEntries(Object.entries(parsed).filter(([key])=>key!=='version'&&Object.hasOwn(raw as object,key)));
  return transaction(async session=>{
   const {row,party}=await authorizeOpportunity(context,companyId,id,'pipeline:write',session);
   if(row.version!==version)throw new RecordConflict();if(['ganha','perdida'].includes(row.stage))throw new OpportunityRuleRejected();
   const next={...row.toObject(),...changes};if(next.stage==='perdida'&&!next.lossReason?.trim())throw new OpportunityRuleRejected();
   if(next.stage!=='perdida'&&changes.lossReason)throw new OpportunityRuleRejected();
   await touch(party,context,companyId,session);await links(context,companyId,party._id,changes,row.toObject(),session);
   // Closure probabilities are fixed by the server; an open stage change takes the configured default unless one is sent.
   const probability=next.stage==='ganha'?100:next.stage==='perdida'?0:changes.probability??(next.stage!==row.stage?(await pipelineSettings(context,companyId,session)).stages.find(stage=>stage.key===next.stage)!.probability:row.probability);
   const updated=await Opportunity.findOneAndUpdate({...scope(context,companyId,'pipeline:write'),_id:id,version},{$set:{...changes,probability,lossReason:next.stage==='perdida'?next.lossReason:'',closedAt:['ganha','perdida'].includes(next.stage)?new Date():null},$inc:{version:1}},{new:true,session,runValidators:true});
   if(!updated)throw new RecordConflict();
   const detail=[row.probability!==updated.probability?'Probabilidade '+row.probability+'% → '+updated.probability+'%':'',String(row.propertyId??'')!==String(updated.propertyId??'')?'Propriedade alterada':'',String(row.equipmentId??'')!==String(updated.equipmentId??'')?'Equipamento alterado':'',row.amountCents!==updated.amountCents?'Valor alterado':''].filter(Boolean).join(' · ');
   await history(context,companyId,id,id,row.stage===updated.stage?'opportunity.updated':'opportunity.stage_changed',session,row.stage===updated.stage?undefined:{previousStage:row.stage,nextStage:updated.stage},detail);return view(context,companyId,updated,party);
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
  return {items:rows.map(row=>({id:String(row._id),action:row.action,actorName:auditActorLabel(actors,String(row.actorId),context.userId),previousStage:row.previousStage,nextStage:row.nextStage,...(row.detail?{detail:row.detail}:{}),createdAt:row.createdAt.toISOString()})),total,page:input.page,pageSize:20};
 }
};
