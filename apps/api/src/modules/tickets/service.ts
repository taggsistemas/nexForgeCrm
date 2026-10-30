import mongoose from 'mongoose';
import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import {defaultTicketCriticalityNames,elapsedMinutes,openTicketStatuses,ticketCriticalities,type TicketAction,type TicketEventView,type TicketSettingsView,type TicketView} from '../../../../../packages/contracts/src/tickets.js';
import {companyScope,AccessDenied} from '../../infrastructure/access.js';
import {auditActorLabel,auditActorNames} from '../../infrastructure/audit-actors.js';
import {commercialFilter} from '../identity/profile-access.js';
import {Membership,Role,User} from '../identity/models.js';
import {Equipment,Party,Property} from '../relationships/models.js';
import {objectId} from '../relationships/input.js';
import {RecordConflict,RecordNotFound,InvalidReference} from '../relationships/service.js';
import {locationNames} from '../relationships/locations.js';
import {technicalTeamAuthority} from '../technical/access.js';
import {Ticket,TicketEvent,TicketSequence,TicketSetting} from './models.js';
import {TechnicalWork} from '../technical/models.js';
import {ticketActionInputs,ticketCreateInput,ticketListInput,ticketOptionsInput,ticketSettingsInput,TicketRuleRejected} from './input.js';
const oid=(id:string)=>new mongoose.Types.ObjectId(id);
const literal=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
async function transact<T>(fn:(session:mongoose.ClientSession)=>Promise<T>){try{return await mongoose.connection.transaction(fn);}catch(error){if((error as {code?:number}).code===11000)throw new RecordConflict();throw error;}}
type Authority={kind:'company'}|{kind:'territory';regionIds:mongoose.Types.ObjectId[];technicianIds:mongoose.Types.ObjectId[]}|{kind:'portfolio'}|{kind:'assigned'};
/**
 * Who sees tickets: company-wide profiles all of them; technical coordination its live territories and
 * technicians; commercial profiles the live portfolio of the customer; technicians only tickets assigned to them.
 */
export async function authority(ctx:AccessContext,companyId:string,session?:mongoose.ClientSession):Promise<Authority>{
 companyScope(ctx,companyId,'ticket:read');if(!ctx.dataAccess)throw new AccessDenied();
 if(ctx.dataAccess.visibility==='company')return {kind:'company'};
 if(ctx.dataAccess.technicalManagementVisibility==='team'){const team=await technicalTeamAuthority({...ctx,permissions:[...ctx.permissions,'technical:read'],dataAccess:{...ctx.dataAccess,visibility:'team'}},companyId,session);return {kind:'territory',regionIds:team!.regionIds,technicianIds:team!.technicianIds};}
 if(ctx.permissions.includes('lead:read')||ctx.permissions.includes('customer:read'))return {kind:'portfolio'};
 return {kind:'assigned'};
}
function kinds(ctx:AccessContext){return [...(ctx.permissions.includes('lead:read')?['lead']:[]),...(ctx.permissions.includes('customer:read')?['customer']:[])];}
function portfolioFilter(ctx:AccessContext,companyId:string){const query=Party.find(commercialFilter(ctx,companyId,ctx.permissions.includes('lead:read')?'lead:read':'customer:read',{kind:{$in:kinds(ctx)}}));query.cast(Party);return query.getFilter();}
/** Scope stages applied before counts and pagination. */
export function scopeStages(ctx:AccessContext,companyId:string,access:Authority):mongoose.PipelineStage[]{
 const ids={tenantId:oid(ctx.tenantId),companyId:oid(companyId)};
 const stages:mongoose.PipelineStage[]=[{$lookup:{from:Party.collection.name,localField:'partyId',foreignField:'_id',pipeline:[{$match:{...ids,...(access.kind==='portfolio'?portfolioFilter(ctx,companyId):{})}},{$project:{name:1,ownerId:1}}],as:'party'}},{$unwind:'$party'},
  {$lookup:{from:Property.collection.name,localField:'propertyId',foreignField:'_id',pipeline:[{$match:ids},{$project:{regionId:1}}],as:'property'}},{$unwind:{path:'$property',preserveNullAndEmptyArrays:true}}];
 if(access.kind==='territory')stages.push({$match:{$or:[{'property.regionId':{$in:access.regionIds}},{assigneeId:{$in:[...access.technicianIds,oid(ctx.userId)]}}]}});
 if(access.kind==='assigned')stages.push({$match:{assigneeId:oid(ctx.userId)}});
 return stages;
}
function manages(ctx:AccessContext,access:Authority,regionId:unknown,assigneeId:unknown){
 if(!ctx.permissions.includes('ticket:manage'))return false;
 if(access.kind==='company')return ctx.dataAccess?.technicalManagementVisibility==='company'||ctx.dataAccess?.visibility==='company';
 if(access.kind!=='territory')return false;
 return access.regionIds.some(id=>String(id)===String(regionId))||access.technicianIds.some(id=>String(id)===String(assigneeId));
}
export async function ticketSettings(ctx:AccessContext,companyId:string,session?:mongoose.ClientSession):Promise<TicketSettingsView>{
 const row=await TicketSetting.findOne({tenantId:ctx.tenantId,companyId}).session(session??null);
 return {criticalities:ticketCriticalities.map(key=>({key,label:row?.criticalities.find(item=>item.key===key)?.label??defaultTicketCriticalityNames[key]})),version:row?.version??0};
}
async function views(ctx:AccessContext,companyId:string,access:Authority,rows:Record<string,any>[]):Promise<TicketView[]>{
 const now=Date.now();
 const [names,assignees,previous]=await Promise.all([locationNames(ctx,companyId,rows.map(row=>({propertyId:row.propertyId,equipmentId:row.equipmentId}))),auditActorNames(ctx.tenantId,rows.flatMap(row=>row.assigneeId?[String(row.assigneeId)]:[])),Ticket.find({tenantId:ctx.tenantId,companyId,_id:{$in:rows.flatMap(row=>row.previousTicketId?[row.previousTicketId]:[])}}).select('number')]);
 const numbers=new Map(previous.map(row=>[String(row._id),row.number]));
 return rows.map(row=>{const property=names.property.get(String(row.propertyId)),open=(openTicketStatuses as readonly string[]).includes(row.status),regionId=row.property?.regionId?String(row.property.regionId):null;
  return {id:String(row._id),number:row.number,partyId:String(row.partyId),partyName:row.party?.name??'',propertyId:String(row.propertyId),propertyName:property?.name??'Propriedade indisponível',regionId,regionName:property?.regionName??'',equipmentId:row.equipmentId?String(row.equipmentId):null,equipmentName:row.equipmentId?names.equipment.get(String(row.equipmentId))??'Equipamento indisponível':'',
   origin:row.origin,criticality:row.criticality,title:row.title,description:row.description,status:row.status,assigneeId:row.assigneeId?String(row.assigneeId):null,assigneeName:row.assigneeId?assignees.get(String(row.assigneeId))??'Usuário indisponível':'',escalationLevel:row.escalationLevel,previousTicketId:row.previousTicketId?String(row.previousTicketId):null,previousTicketNumber:row.previousTicketId?numbers.get(String(row.previousTicketId))??'':'',
   openedAt:new Date(row.openedAt).toISOString(),firstResponseAt:row.firstResponseAt?new Date(row.firstResponseAt).toISOString():null,agreedDeadline:row.agreedDeadline?new Date(row.agreedDeadline).toISOString():null,resolvedAt:row.resolvedAt?new Date(row.resolvedAt).toISOString():null,cancelledAt:row.cancelledAt?new Date(row.cancelledAt).toISOString():null,solution:row.solution,
   responseMinutes:elapsedMinutes(row.openedAt,row.firstResponseAt),resolutionMinutes:elapsedMinutes(row.openedAt,row.resolvedAt),overdue:Boolean(row.agreedDeadline&&new Date(row.agreedDeadline).valueOf()<(row.resolvedAt?new Date(row.resolvedAt).valueOf():open?now:Number.POSITIVE_INFINITY)),canManage:open&&manages(ctx,access,regionId,row.assigneeId),version:row.version};});
}
async function load(ctx:AccessContext,companyId:string,id:string,session?:mongoose.ClientSession){
 objectId.parse(id);const access=await authority(ctx,companyId,session);
 const [row]=await Ticket.aggregate([{$match:{tenantId:oid(ctx.tenantId),companyId:oid(companyId),_id:oid(id)}},...scopeStages(ctx,companyId,access)]).session(session??null);
 if(!row)throw new RecordNotFound();return {row,access};
}
/** Assignees: active technicians/coordinators of the company; a territory coordinator only its own technicians or itself. */
async function assertAssignee(ctx:AccessContext,companyId:string,access:Authority,assigneeId:string,session:mongoose.ClientSession){
 if(access.kind==='territory'&&assigneeId!==ctx.userId&&!access.technicianIds.some(id=>String(id)===assigneeId))throw new InvalidReference();
 const roles=await Role.find({tenantId:ctx.tenantId,key:{$in:['technician','technical_coordinator']}}).select('_id').session(session);
 if(!await Membership.exists({tenantId:ctx.tenantId,userId:assigneeId,companyIds:companyId,active:true,roleIds:{$in:roles.map(role=>role._id)}}).session(session)||!await User.exists({_id:assigneeId,active:true}).session(session))throw new InvalidReference();
}
async function event(ctx:AccessContext,companyId:string,ticketId:unknown,action:string,statusAfter:string,session:mongoose.ClientSession,extra:{note?:string;fromAssigneeId?:unknown;toAssigneeId?:unknown}={}){
 await TicketEvent.create([{tenantId:ctx.tenantId,companyId,ticketId,actorId:ctx.userId,action,statusAfter,note:extra.note??'',fromAssigneeId:extra.fromAssigneeId??null,toAssigneeId:extra.toAssigneeId??null}],{session});
}
const eventKeys:Record<TicketAction,string>={'first-response':'first_response',assign:'assigned',deadline:'deadline_set',escalate:'escalated',status:'status_changed',resolve:'resolved',cancel:'cancelled'};
/** Opens a ticket inside the caller's transaction (online creation and offline sync): live Party authority, property of the Party, server instants. */
export async function openTicket(ctx:AccessContext,companyId:string,input:ReturnType<typeof ticketCreateInput.parse>,session:mongoose.ClientSession){
 const access=await authority(ctx,companyId,session);
 const [party]=await openableParties(ctx,companyId,access,{_id:oid(input.partyId)},session);if(!party)throw new RecordNotFound();
 const property=await Property.findOne({_id:input.propertyId,tenantId:ctx.tenantId,companyId,partyId:party._id,archived:false}).session(session);if(!property)throw new InvalidReference();
 if(access.kind==='territory'&&!access.regionIds.some(id=>String(id)===String(property.regionId)))throw new InvalidReference();
 if(input.equipmentId&&!await Equipment.exists({_id:input.equipmentId,tenantId:ctx.tenantId,companyId,partyId:party._id,propertyId:property._id,archived:false}).session(session))throw new InvalidReference();
 if(input.previousTicketId&&!await Ticket.exists({_id:input.previousTicketId,tenantId:ctx.tenantId,companyId,partyId:party._id,status:'resolvido'}).session(session))throw new InvalidReference();
 await Party.updateOne({_id:party._id,tenantId:ctx.tenantId,companyId},{$inc:{commercialRevision:1}},{session});
 const sequence=await TicketSequence.findOneAndUpdate({tenantId:ctx.tenantId,companyId},{$inc:{value:1}},{upsert:true,new:true,session,setDefaultsOnInsert:true});
 const [row]=await Ticket.create([{...input,tenantId:ctx.tenantId,companyId,number:'CH-'+String(sequence!.value).padStart(6,'0'),openedBy:ctx.userId,openedAt:new Date()}],{session});
 await event(ctx,companyId,row!._id,'opened','aberto',session,{note:input.description});
 return row!;
}
export const ticketService={
 async settings(ctx:AccessContext,companyId:string){companyScope(ctx,companyId,'ticket:read');return ticketSettings(ctx,companyId);},
 async saveSettings(ctx:AccessContext,companyId:string,raw:unknown){
  const input=ticketSettingsInput.parse(raw),scope=companyScope(ctx,companyId,'list:manage');
  return transact(async session=>{
   const current=await TicketSetting.findOne(scope).session(session);if((current?.version??0)!==input.version)throw new RecordConflict();
   if(current){current.set({criticalities:input.criticalities,version:current.version+1});await current.save({session});}else await TicketSetting.create([{...scope,criticalities:input.criticalities,version:1}],{session});
   return ticketSettings(ctx,companyId,session);
  });
 },
 /** Queue ordered by criticality, then age; scope is applied before counts and pagination. */
 async list(ctx:AccessContext,companyId:string,raw:unknown){
  const input=ticketListInput.parse(raw),access=await authority(ctx,companyId);
  const status=input.status==='open'?{status:{$in:[...openTicketStatuses]}}:input.status==='closed'?{status:{$in:['resolvido','cancelado']}}:{};
  const match={tenantId:oid(ctx.tenantId),companyId:oid(companyId),...status,...(input.criticality?{criticality:input.criticality}:{}),...(input.assigneeId?{assigneeId:oid(input.assigneeId)}:{}),...(input.partyId?{partyId:oid(input.partyId)}:{}),...(input.equipmentId?{equipmentId:oid(input.equipmentId)}:{}),...(input.overdue==='true'?{status:{$in:[...openTicketStatuses]},agreedDeadline:{$lt:new Date()}}:{}),...(input.search?{$or:[{number:{$regex:literal(input.search),$options:'i'}},{title:{$regex:literal(input.search),$options:'i'}}]}:{})};
  const [result]=await Ticket.aggregate([{$match:match},...scopeStages(ctx,companyId,access),...(input.regionId?[{$match:{'property.regionId':oid(input.regionId)}}]:[]),
   {$set:{rank:{$indexOfArray:[[...ticketCriticalities],'$criticality']}}},{$sort:{rank:1,openedAt:1,_id:1}},
   {$facet:{total:[{$count:'count'}],counts:[{$match:{status:{$in:[...openTicketStatuses]}}},{$group:{_id:'$criticality',total:{$sum:1}}}],items:[{$skip:(input.page-1)*20},{$limit:20}]}}]);
  return {items:await views(ctx,companyId,access,result.items),total:result.total[0]?.count??0,openByCriticality:Object.fromEntries(ticketCriticalities.map(key=>[key,result.counts.find((item:{_id:string})=>item._id===key)?.total??0])),page:input.page,pageSize:20};
 },
 async detail(ctx:AccessContext,companyId:string,id:string){
  const {row,access}=await load(ctx,companyId,id);
  const events=await TicketEvent.find({tenantId:ctx.tenantId,companyId,ticketId:row._id}).sort({createdAt:1,_id:1}).limit(200);
  const names=await auditActorNames(ctx.tenantId,events.flatMap(item=>[String(item.actorId),...(item.fromAssigneeId?[String(item.fromAssigneeId)]:[]),...(item.toAssigneeId?[String(item.toAssigneeId)]:[])]));
  const history:TicketEventView[]=events.map(item=>({action:item.action,actor:auditActorLabel(names,String(item.actorId),ctx.userId),at:item.createdAt.toISOString(),note:item.note,fromAssignee:item.fromAssigneeId?names.get(String(item.fromAssigneeId))??'Usuário indisponível':'',toAssignee:item.toAssigneeId?names.get(String(item.toAssigneeId))??'Usuário indisponível':'',statusAfter:item.statusAfter}));
  return {record:(await views(ctx,companyId,access,[row]))[0]!,history};
 },
 /** Customers the actor may open tickets for, or properties/equipment of one of them. */
 async options(ctx:AccessContext,companyId:string,raw:unknown){
  companyScope(ctx,companyId,'ticket:write');const input=ticketOptionsInput.parse(raw),access=await authority(ctx,companyId);
  const parties=await openableParties(ctx,companyId,access,input.partyId?{_id:oid(input.partyId)}:input.search?{name:{$regex:literal(input.search),$options:'i'}}:{});
  if(!input.partyId)return {parties:parties.map(row=>({id:String(row._id),name:row.name})),properties:[],equipment:[]};
  if(!parties.length)throw new RecordNotFound();
  const [properties,equipment]=await Promise.all([Property.find({tenantId:ctx.tenantId,companyId,partyId:input.partyId,archived:false,...(access.kind==='territory'?{regionId:{$in:access.regionIds}}:{})}).select('name').sort({name:1}).limit(200),Equipment.find({tenantId:ctx.tenantId,companyId,partyId:input.partyId,archived:false}).select('brand model serialNumber propertyId').sort({brand:1,model:1}).limit(500)]);
  return {parties:parties.map(row=>({id:String(row._id),name:row.name})),properties:properties.map(row=>({id:String(row._id),name:row.name})),equipment:equipment.map(row=>({id:String(row._id),propertyId:String(row.propertyId),name:[row.brand,row.model,row.serialNumber&&'série '+row.serialNumber].filter(Boolean).join(' ')}))};
 },
 async assignees(ctx:AccessContext,companyId:string){
  companyScope(ctx,companyId,'ticket:manage');const access=await authority(ctx,companyId);
  const roles=await Role.find({tenantId:ctx.tenantId,key:{$in:['technician','technical_coordinator']}}).select('_id');
  const members=await Membership.find({tenantId:ctx.tenantId,companyIds:companyId,active:true,roleIds:{$in:roles.map(role=>role._id)},...(access.kind==='territory'?{userId:{$in:[...access.technicianIds,oid(ctx.userId)]}}:{})}).select('userId').limit(500);
  const users=await User.find({_id:{$in:members.map(row=>row.userId)},active:true}).select('name').sort({name:1});
  return {items:users.map(user=>({id:String(user._id),name:user.name}))};
 },
 async create(ctx:AccessContext,companyId:string,raw:unknown){
  const input=ticketCreateInput.parse(raw);companyScope(ctx,companyId,'ticket:write');
  return transact(async session=>{const row=await openTicket(ctx,companyId,input,session);return {id:String(row._id),number:row.number};});
 },
 /** Triage actions. Only managers of the ticket's live territory (or company-wide) act; instants come from the server. */
 async act(ctx:AccessContext,companyId:string,id:string,action:TicketAction,raw:unknown){
  const input=ticketActionInputs[action].parse(raw) as {version:number;note?:string;assigneeId?:string;agreedDeadline?:Date;reason?:string;status?:string;solution?:string};
  companyScope(ctx,companyId,'ticket:manage');
  return transact(async session=>{
   const {row,access}=await load(ctx,companyId,id,session);
   if(!manages(ctx,access,row.property?.regionId,row.assigneeId))throw new AccessDenied();
   if(row.version!==input.version)throw new RecordConflict();
   if(!(openTicketStatuses as readonly string[]).includes(row.status))throw new TicketRuleRejected('CLOSED');
   const now=new Date(),set:Record<string,unknown>={},assignee=input.assigneeId;
   if(action==='first-response'){if(row.firstResponseAt)throw new TicketRuleRejected('ALREADY_RESPONDED');set.firstResponseAt=now;if(row.status==='aberto')set.status='em_atendimento';}
   if(assignee){await assertAssignee(ctx,companyId,access,assignee,session);if(String(row.assigneeId??'')===assignee&&action==='assign')throw new TicketRuleRejected('SAME_ASSIGNEE');set.assigneeId=oid(assignee);}
   if(action==='deadline'){if(input.agreedDeadline!.valueOf()<=new Date(row.openedAt).valueOf())throw new TicketRuleRejected('DEADLINE_BEFORE_OPENING');set.agreedDeadline=input.agreedDeadline;}
   if(action==='escalate')set.escalationLevel=row.escalationLevel+1;
   if(action==='status')set.status=input.status;
   if(action==='resolve'&&await TechnicalWork.exists({tenantId:ctx.tenantId,companyId,ticketId:row._id,state:{$in:['pending','in_progress']}}).session(session))throw new TicketRuleRejected('OPEN_WORK_ORDER');
   if(action==='resolve'){set.status='resolvido';set.resolvedAt=now;set.solution=input.solution;if(!row.firstResponseAt)set.firstResponseAt=now;}
   if(action==='cancel'){set.status='cancelado';set.cancelledAt=now;set.cancelReason=input.reason;}
   const updated=await Ticket.findOneAndUpdate({_id:row._id,tenantId:ctx.tenantId,companyId,version:input.version},{$set:set,$inc:{version:1}},{new:true,session,runValidators:true});if(!updated)throw new RecordConflict();
   await event(ctx,companyId,row._id,eventKeys[action],updated.status,session,{note:input.note??input.reason??input.solution??(action==='deadline'?'Prazo pactuado: '+input.agreedDeadline!.toISOString():''),...(assignee?{fromAssigneeId:row.assigneeId,toAssigneeId:assignee}:{})});
   return (await load(ctx,companyId,id,session).then(({row:fresh})=>views(ctx,companyId,access,[fresh])))[0]!;
  });
 },
};
/** Parties a ticket may be opened for, by the same authority rules used to read tickets. */
async function openableParties(ctx:AccessContext,companyId:string,access:Authority,extra:Record<string,unknown>,session?:mongoose.ClientSession){
 const base={tenantId:oid(ctx.tenantId),companyId:oid(companyId),archived:false,...extra};
 if(access.kind==='assigned')throw new AccessDenied();
 if(access.kind==='portfolio')return Party.find({$and:[portfolioFilter(ctx,companyId),base]}).select('name').sort({name:1}).limit(30).session(session??null);
 if(access.kind==='territory'){
  const partyIds=await Property.distinct('partyId',{tenantId:ctx.tenantId,companyId,archived:false,regionId:{$in:access.regionIds}}).session(session??null);
  return Party.find({...base,_id:extra._id?{$in:partyIds.filter(id=>String(id)===String(extra._id))}:{$in:partyIds}}).select('name').sort({name:1}).limit(30).session(session??null);
 }
 return Party.find(base).select('name').sort({name:1}).limit(30).session(session??null);
}
