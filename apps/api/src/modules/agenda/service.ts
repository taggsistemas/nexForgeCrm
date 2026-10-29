import {VisitPlan} from '../territories/models.js';
import {AgendaRuleRejected} from './recurrence.js';
import mongoose from 'mongoose';
import type {AccessContext,Permission} from '../../../../../packages/contracts/src/index.js';
import type {AgendaActivityView,AgendaSource,AgendaSeriesView,AttendanceView} from '../../../../../packages/contracts/src/agenda.js';
import {assertServiceLocation,locationNames,type LocationNames} from '../relationships/locations.js';
import {Property} from '../relationships/models.js';
import {FieldExecution} from '../field-visits/models.js';
import {companyScope} from '../../infrastructure/access.js';
import {commercialFilter} from '../identity/profile-access.js';
import {Party} from '../relationships/models.js';
import {Membership,User} from '../identity/models.js';
import {objectId} from '../relationships/input.js';
import {RecordNotFound,RecordConflict,InvalidReference} from '../relationships/service.js';
import {Opportunity,OpportunityActivity,OpportunityHistory} from '../opportunities/models.js';
import {authorizeOpportunity,opportunityService,OpportunityRuleRejected} from '../opportunities/service.js';
import {AgendaActivity,AgendaSeries,AgendaAudit} from './models.js';
import {agendaListInput,createAgendaInput,updateAgendaInput,referenceInput,cancelSeriesInput,attendanceInput} from './input.js';
import {materializeOccurrences,wallTimeToInstant,dayBoundary} from './recurrence.js';
const scope=(context:AccessContext,companyId:string,permission:Permission)=>{const result=companyScope(context,companyId,permission);commercialFilter(context,companyId,permission);return result;};
function parentFilter(context:AccessContext,companyId:string,permission:Permission,extra:Record<string,unknown>={}){
 const kinds:string[]=[];if(context.permissions.includes('lead:read'))kinds.push('lead');if(context.permissions.includes('customer:read'))kinds.push('customer');
 return commercialFilter(context,companyId,permission,{archived:false,kind:{$in:kinds},...extra});
}
function castParentFilter(context:AccessContext,companyId:string,extra:Record<string,unknown>={}){
 const query=Party.find(parentFilter(context,companyId,'activity:read',extra));query.cast(Party);return query.getFilter();
}
async function authorizeParty(context:AccessContext,companyId:string,id:string,permission:Permission,session?:mongoose.ClientSession){
 objectId.parse(id);const query=Party.findOne(parentFilter(context,companyId,permission,{_id:id}));if(session)query.session(session);const party=await query;if(!party)throw new RecordNotFound();return party;
}
async function touch(party:InstanceType<typeof Party>,context:AccessContext,companyId:string,session:mongoose.ClientSession){await Party.updateOne({_id:party._id,...scope(context,companyId,'activity:write')},{$inc:{commercialRevision:1}},{session});}
async function load(context:AccessContext,companyId:string,source:AgendaSource,id:string,permission:Permission,session?:mongoose.ClientSession){
 objectId.parse(id);const filter={...scope(context,companyId,permission),_id:id};
 if(source==='opportunity'){
  const query=OpportunityActivity.findOne(filter);if(session)query.session(session);const activity=await query;if(!activity)throw new RecordNotFound();
  const {row,party}=await authorizeOpportunity(context,companyId,String(activity.opportunityId),'pipeline:read',session);return {activity,party,opportunity:row};
 }
 const query=AgendaActivity.findOne(filter);if(session)query.session(session);const activity=await query;if(!activity)throw new RecordNotFound();
 const party=await authorizeParty(context,companyId,String(activity.partyId),permission,session);return {activity,party,opportunity:null};
}
/** Location of the attendance: its own for direct activities, the opportunity's for opportunity activities. */
const locationOf=(activity:InstanceType<typeof AgendaActivity>|InstanceType<typeof OpportunityActivity>,opportunity?:{propertyId?:unknown;equipmentId?:unknown}|null)=>'partyId'in activity?{propertyId:activity.propertyId??null,equipmentId:activity.equipmentId??null}:{propertyId:opportunity?.propertyId??null,equipmentId:opportunity?.equipmentId??null};
function view(activity:InstanceType<typeof AgendaActivity>|InstanceType<typeof OpportunityActivity>,source:AgendaSource,party:InstanceType<typeof Party>,ownerName:string,opportunity:{title:string;propertyId?:unknown;equipmentId?:unknown}|null|undefined,names:LocationNames):AgendaActivityView{
 const location=locationOf(activity,opportunity),property=location.propertyId?names.property.get(String(location.propertyId)):undefined;
 return {propertyId:location.propertyId?String(location.propertyId):null,propertyName:property?.name??(location.propertyId?'Propriedade indisponível':''),regionName:property?.regionName??'',equipmentId:location.equipmentId?String(location.equipmentId):null,equipmentName:location.equipmentId?names.equipment.get(String(location.equipmentId))??'Equipamento indisponível':'',objective:activity.objective??'',result:activity.result??'',nextAction:activity.nextAction??'',...('offlineCapturedAt'in activity&&activity.offlineCapturedAt?{offlineCapturedAt:activity.offlineCapturedAt.toISOString()}:{}),id:String(activity._id),source,opportunityId:'opportunityId'in activity?String(activity.opportunityId):'',partyId:String(party._id),partyName:party.name,ownerId:String(party.ownerId),ownerName,opportunityTitle:opportunity?.title??'',title:activity.title,type:activity.type,status:activity.status,dueAt:activity.dueAt.toISOString(),completedAt:activity.completedAt?.toISOString()??null,notes:activity.notes,version:activity.version,...(activity.seriesId?{seriesId:String(activity.seriesId)}:{})};
}
function seriesView(row:InstanceType<typeof AgendaSeries>):AgendaSeriesView{return {id:String(row._id),frequency:row.frequency,interval:row.interval,count:row.count,timeZone:row.timeZone,state:row.state,version:row.version};}
async function audit(context:AccessContext,companyId:string,entityId:unknown,source:string,action:string,session:mongoose.ClientSession,affectedCount?:number){await AgendaAudit.create([{...scope(context,companyId,'activity:write'),actorId:context.userId,entityId,source,action,affectedCount}],{session});}
const transaction=<T>(fn:(session:mongoose.ClientSession)=>Promise<T>)=>mongoose.connection.transaction(fn);
export const agendaService={
 async owners(context:AccessContext,companyId:string){
  const company=scope(context,companyId,'activity:read'),visibility=context.dataAccess!;
  const visible=visibility.visibility==='company'?{}:{userId:{$in:visibility.visibility==='own'?[context.userId]:[context.userId,...visibility.supervisedUserIds]}};
  const members=await Membership.find({tenantId:company.tenantId,companyIds:companyId,active:true,...visible}).limit(500);
  const users=await User.find({_id:{$in:members.map(row=>row.userId)},active:true}).select('name').sort({name:1});
  return {items:users.map(row=>({id:String(row._id),name:row.name}))};
 },
 async references(context:AccessContext,companyId:string,raw:unknown){
  const input=referenceInput.parse(raw);scope(context,companyId,'activity:write');
  const escaped=input.search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(input.source==='party'){
   const rows=await Party.find(parentFilter(context,companyId,'activity:write',input.search?{name:{$regex:escaped,$options:'i'}}:{})).sort({name:1,_id:1}).limit(30);
   return {items:rows.map(row=>({id:String(row._id),name:row.name}))};
  }
  scope(context,companyId,'pipeline:read');
  const match=scope(context,companyId,'activity:write'),parentQuery=Party.find(parentFilter(context,companyId,'activity:write'));parentQuery.cast(Party);
  const rows=await Opportunity.aggregate([{$match:{tenantId:new mongoose.Types.ObjectId(match.tenantId),companyId:new mongoose.Types.ObjectId(companyId),stage:{$in:['descoberta','proposta','negociacao']},...(input.search?{title:{$regex:escaped,$options:'i'}}:{})}},{$lookup:{from:Party.collection.name,localField:'partyId',foreignField:'_id',pipeline:[{$match:parentQuery.getFilter()}],as:'party'}},{$unwind:'$party'},{$sort:{title:1,_id:1}},{$limit:30},{$project:{_id:1,title:1,'party.name':1}}]);
  return {items:rows.map(row=>({id:String(row._id),name:row.title+' — '+row.party.name}))};
 },
 async list(context:AccessContext,companyId:string,raw:unknown){
  const input=agendaListInput.parse(raw),company=scope(context,companyId,'activity:read');
  const ids={tenantId:new mongoose.Types.ObjectId(company.tenantId),companyId:new mongoose.Types.ObjectId(companyId)};
  const range={dueAt:{$gte:dayBoundary(input.startDate,input.timeZone),$lt:dayBoundary(input.endDate,input.timeZone)}};
  const match={...ids,...range,...(input.status?{status:input.status}:{}),...(input.type?{type:input.type}:{}),...(input.overdue==='true'?{$and:[{status:'pendente'},{dueAt:{$lt:new Date()}}]}:{})};
  const pipeline:mongoose.PipelineStage[]=[{$match:match},{$set:{source:'party',linkPartyId:'$partyId',linkPropertyId:'$propertyId',linkEquipmentId:'$equipmentId',opportunityTitle:''}}];
  if(context.permissions.includes('pipeline:read'))pipeline.push({$unionWith:{coll:OpportunityActivity.collection.name,pipeline:[{$match:match},{$lookup:{from:Opportunity.collection.name,localField:'opportunityId',foreignField:'_id',pipeline:[{$match:ids}],as:'opportunity'}},{$unwind:'$opportunity'},{$set:{source:'opportunity',linkPartyId:'$opportunity.partyId',linkPropertyId:'$opportunity.propertyId',linkEquipmentId:'$opportunity.equipmentId',opportunityTitle:'$opportunity.title'}}]}});
  pipeline.push({$lookup:{from:Party.collection.name,localField:'linkPartyId',foreignField:'_id',pipeline:[{$match:castParentFilter(context,companyId,input.ownerId?{ownerId:input.ownerId}:{})},{$project:{name:1,ownerId:1}}],as:'party'}},{$unwind:'$party'});
  // Territory belongs to the property, not to the seller portfolio; checked against the same tenant/company.
  if(input.regionId)pipeline.push({$lookup:{from:Property.collection.name,localField:'linkPropertyId',foreignField:'_id',pipeline:[{$match:{...ids,regionId:new mongoose.Types.ObjectId(input.regionId)}},{$project:{_id:1}}],as:'territory'}},{$unwind:'$territory'});
  pipeline.push({$sort:{dueAt:1,_id:1,source:1}},{$facet:{total:[{$count:'count'}],dailyCounts:[{$group:{_id:{$dateToString:{date:'$dueAt',format:'%Y-%m-%d',timezone:input.timeZone}},total:{$sum:1}}},{$sort:{_id:1}}],items:[{$skip:(input.page-1)*50},{$limit:50},{$lookup:{from:User.collection.name,localField:'party.ownerId',foreignField:'_id',pipeline:[{$project:{name:1}}],as:'owner'}}]}});
  const [result]=await AgendaActivity.aggregate(pipeline);
  const names=await locationNames(context,companyId,result.items.map((row:Record<string,unknown>)=>({propertyId:row.linkPropertyId,equipmentId:row.linkEquipmentId})));
  const items:AgendaActivityView[]=result.items.map((row:Record<string,unknown>)=>{const party=Party.hydrate(row.party),owner=row.owner as {name:string}[];return view(row.source==='party'?AgendaActivity.hydrate(row):OpportunityActivity.hydrate(row),row.source as AgendaSource,party,owner[0]?.name??'Responsável indisponível',{title:String(row.opportunityTitle??''),propertyId:row.linkPropertyId,equipmentId:row.linkEquipmentId},names);});
  return {items,total:result.total[0]?.count??0,page:input.page,pageSize:50,dailyCounts:result.dailyCounts.map((row:{_id:string;total:number})=>({date:row._id,total:row.total}))};
 },
 async detail(context:AccessContext,companyId:string,source:AgendaSource,id:string){
  const {activity,party,opportunity}=await load(context,companyId,source,id,'activity:read');
  const [owner,series]=await Promise.all([User.findById(party.ownerId).select('name'),activity.seriesId?AgendaSeries.findOne({...scope(context,companyId,'activity:read'),_id:activity.seriesId,partyId:party._id}):null]);
  return {record:view(activity,source,party,owner?.name??'Responsável indisponível',opportunity,await locationNames(context,companyId,[locationOf(activity,opportunity)])),series:series?seriesView(series):null};
 },
 async create(context:AccessContext,companyId:string,raw:unknown){
  const input=createAgendaInput.parse(raw),company=scope(context,companyId,'activity:write'),dates=materializeOccurrences(input.startLocal,input.timeZone,input.recurrence);
  return transaction(async session=>{
   let party:InstanceType<typeof Party>,opportunity:InstanceType<typeof Opportunity>|null=null;
   if(input.link.source==='opportunity'){
    const linked=await authorizeOpportunity(context,companyId,input.link.id,'pipeline:read',session);party=linked.party;opportunity=linked.row;
    if(['ganha','perdida'].includes(opportunity.stage))throw new OpportunityRuleRejected();
   }else party=await authorizeParty(context,companyId,input.link.id,'activity:write',session);
   // Opportunity activities inherit the opportunity location; only direct activities carry their own.
   const location:Record<string,unknown>={propertyId:input.propertyId??null,equipmentId:input.equipmentId??null};
   if(opportunity&&(location.propertyId||location.equipmentId))throw new InvalidReference();
   if(!opportunity)await assertServiceLocation(context,companyId,party._id,location,{},session);
   await touch(party,context,companyId,session);
   if(opportunity)await Opportunity.updateOne({_id:opportunity._id,...company},{$inc:{activityRevision:1}},{session});
   const series=input.recurrence.frequency==='none'?null:(await AgendaSeries.create([{...company,partyId:party._id,...(opportunity?{opportunityId:opportunity._id}:{}),...input.recurrence,timeZone:input.timeZone,startAt:dates[0]}],{session}))[0]!;
   const payload=dates.map((dueAt,index)=>({...company,title:input.title,type:input.type,notes:input.notes,objective:input.objective,...(opportunity?{}:location),dueAt,...(series?{seriesId:series._id,occurrenceIndex:index}:{}),...(opportunity?{opportunityId:opportunity._id}:{partyId:party._id})}));
   const rows=opportunity?await OpportunityActivity.create(payload,{session,ordered:true}):await AgendaActivity.create(payload,{session,ordered:true});
   await AgendaAudit.insertMany(rows.map(row=>({...company,actorId:context.userId,entityId:row._id,source:input.link.source,action:'agenda.activity.created'})),{session});
   if(opportunity)await OpportunityHistory.insertMany(rows.map(row=>({...company,actorId:context.userId,opportunityId:opportunity!._id,entityId:row._id,action:'activity.created'})),{session});
   if(series)await audit(context,companyId,series._id,'series','agenda.series.created',session,rows.length);
   return {count:rows.length,series:series?seriesView(series):null};
  });
 },
 async update(context:AccessContext,companyId:string,source:AgendaSource,id:string,raw:unknown){
  const input=updateAgendaInput.parse(raw),{version}=input,changes:Record<string,unknown>=Object.fromEntries(Object.entries(input).filter(([key])=>!['version','startLocal','timeZone'].includes(key)));
  if(input.startLocal&&input.timeZone)changes.dueAt=wallTimeToInstant(input.startLocal,input.timeZone).toISOString();
  if(source==='opportunity'){
   const {activity}=await load(context,companyId,source,id,'activity:write');
   return opportunityService.updateActivity(context,companyId,String(('opportunityId'in activity)?activity.opportunityId:''),id,{...changes,version});
  }
  return transaction(async session=>{
   const {activity,party}=await load(context,companyId,source,id,'activity:write',session);
   if(activity.version!==version)throw new RecordConflict();if('fieldState'in activity&&activity.fieldState!=='none')throw new AgendaRuleRejected();
   if(Object.hasOwn(changes,'propertyId')||Object.hasOwn(changes,'equipmentId'))await assertServiceLocation(context,companyId,party._id,changes,{propertyId:'propertyId'in activity?activity.propertyId:null,equipmentId:'equipmentId'in activity?activity.equipmentId:null},session);
   await touch(party,context,companyId,session);
   const nextStatus=changes.status??activity.status;
   if('visitPlanId'in activity&&activity.visitPlanId){
    const linked=await VisitPlan.findOne({_id:activity.visitPlanId,...scope(context,companyId,'activity:write')}).session(session);if(!linked)throw new AgendaRuleRejected();
    const dueAt=changes.dueAt?new Date(String(changes.dueAt)):activity.dueAt;
    if(dueAt<dayBoundary(linked.startDate,linked.timeZone)||new Date(dueAt.valueOf()+(activity.durationMinutes??30)*60000)>dayBoundary(linked.endDate,linked.timeZone)||linked.state==='completed'&&nextStatus==='pendente')throw new AgendaRuleRejected();
    await VisitPlan.updateOne({_id:linked._id,...scope(context,companyId,'activity:write')},{$inc:{agendaRevision:1}},{session});
   }
   const row=await AgendaActivity.findOneAndUpdate({...scope(context,companyId,'activity:write'),_id:id,version},{$set:{...changes,completedAt:nextStatus==='concluida'?(activity.completedAt??new Date()):null},$inc:{version:1}},{new:true,session,runValidators:true});
   if(!row)throw new RecordConflict();await audit(context,companyId,row._id,'party','agenda.activity.updated',session);
   return {id:String(row._id)};
  });
 },
 /**
  * Attendances of a customer, optionally narrowed to a property or equipment: direct activities and opportunity
  * activities, with the field outcome when executed. Authorizes the live Party before any count.
  */
 async attendances(context:AccessContext,companyId:string,partyId:string,raw:unknown):Promise<{items:AttendanceView[];total:number;page:number;pageSize:number}>{
  const input=attendanceInput.parse(raw),company=scope(context,companyId,'activity:read'),party=await authorizeParty(context,companyId,partyId,'activity:read');
  const ids={tenantId:new mongoose.Types.ObjectId(company.tenantId),companyId:new mongoose.Types.ObjectId(companyId)};
  const location={...(input.propertyId?{linkPropertyId:new mongoose.Types.ObjectId(input.propertyId)}:{}),...(input.equipmentId?{linkEquipmentId:new mongoose.Types.ObjectId(input.equipmentId)}:{})};
  const pipeline:mongoose.PipelineStage[]=[{$match:{...ids,partyId:party._id}},{$set:{source:'party',linkPropertyId:'$propertyId',linkEquipmentId:'$equipmentId',opportunityTitle:''}}];
  if(context.permissions.includes('pipeline:read'))pipeline.push({$unionWith:{coll:OpportunityActivity.collection.name,pipeline:[{$match:ids},{$lookup:{from:Opportunity.collection.name,localField:'opportunityId',foreignField:'_id',pipeline:[{$match:{...ids,partyId:party._id}}],as:'opportunity'}},{$unwind:'$opportunity'},{$set:{source:'opportunity',linkPropertyId:'$opportunity.propertyId',linkEquipmentId:'$opportunity.equipmentId',opportunityTitle:'$opportunity.title'}}]}});
  pipeline.push({$match:location},{$sort:{dueAt:-1,_id:-1}},{$facet:{total:[{$count:'count'}],items:[{$skip:(input.page-1)*20},{$limit:20},{$lookup:{from:FieldExecution.collection.name,localField:'_id',foreignField:'activityId',pipeline:[{$match:ids},{$project:{outcome:1,notes:1,nextSteps:1,actorId:1}}],as:'execution'}}]}});
  const [result]=await AgendaActivity.aggregate(pipeline);
  const [names,owner]=await Promise.all([locationNames(context,companyId,result.items.map((row:Record<string,unknown>)=>({propertyId:row.linkPropertyId,equipmentId:row.linkEquipmentId}))),User.findById(party.ownerId).select('name')]);
  return {items:result.items.map((row:Record<string,any>):AttendanceView=>{const execution=row.execution[0],propertyId=row.linkPropertyId?String(row.linkPropertyId):null,equipmentId=row.linkEquipmentId?String(row.linkEquipmentId):null;
   return {id:String(row._id),source:row.source,title:row.title,type:row.type,status:row.status,dueAt:row.dueAt.toISOString(),completedAt:row.completedAt?.toISOString()??null,ownerName:owner?.name??'Responsável indisponível',opportunityTitle:row.opportunityTitle??'',propertyId,propertyName:propertyId?names.property.get(propertyId)?.name??'Propriedade indisponível':'',equipmentId,equipmentName:equipmentId?names.equipment.get(equipmentId)??'Equipamento indisponível':'',objective:row.objective||(row.visitPlanItemId?row.notes:'')||'',result:row.result||execution?.notes||'',nextAction:row.nextAction||execution?.nextSteps||'',fieldOutcome:execution?.outcome??null};}),total:result.total[0]?.count??0,page:input.page,pageSize:20};
 },
 async cancelSeries(context:AccessContext,companyId:string,id:string,raw:unknown){
  objectId.parse(id);const {version}=cancelSeriesInput.parse(raw),company=scope(context,companyId,'activity:write');
  return transaction(async session=>{
   const series=await AgendaSeries.findOne({...company,_id:id}).session(session);if(!series)throw new RecordNotFound();
   let party:InstanceType<typeof Party>;
   if(series.opportunityId)party=(await authorizeOpportunity(context,companyId,String(series.opportunityId),'pipeline:read',session)).party;
   else party=await authorizeParty(context,companyId,String(series.partyId),'activity:write',session);
   if(series.version!==version||series.state!=='active')throw new RecordConflict();await touch(party,context,companyId,session);
   const now=new Date(),filter={...company,seriesId:series._id,status:'pendente',dueAt:{$gte:now}};
   let count:number;
   if(series.opportunityId){
    const rows=await OpportunityActivity.find(filter).session(session);
    const result=await OpportunityActivity.updateMany(filter,{$set:{status:'cancelada',completedAt:null},$inc:{version:1}},{session});count=result.modifiedCount;
    if(rows.length)await OpportunityHistory.insertMany(rows.map(row=>({...company,opportunityId:series.opportunityId,actorId:context.userId,entityId:row._id,action:'activity.updated'})),{session});
   }else {if(await AgendaActivity.exists({...filter,fieldState:'in_progress'}).session(session))throw new AgendaRuleRejected();count=(await AgendaActivity.updateMany({...filter,fieldState:{$nin:['completed','interrupted']}},{$set:{status:'cancelada',completedAt:null},$inc:{version:1}},{session})).modifiedCount;}
   const updated=await AgendaSeries.updateOne({...company,_id:id,version,state:'active'},{$set:{state:'cancelled',cancelledAt:now},$inc:{version:1}},{session});if(updated.modifiedCount!==1)throw new RecordConflict();
   await audit(context,companyId,series._id,'series','agenda.series.cancelled',session,count);return {count};
  });
 }
};

