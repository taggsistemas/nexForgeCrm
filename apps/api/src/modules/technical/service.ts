import mongoose from 'mongoose';
import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import {milliToQuantity,quantityToMilli,type TechnicalWorkView,type WorkOrderPartSummary,type WorkOrderPartView} from '../../../../../packages/contracts/src/technical.js';
import {decimalQuantityValid} from '../../../../../packages/contracts/src/catalog.js';
import {catalogService} from '../catalog/service.js';
import {elapsedMinutes} from '../../../../../packages/contracts/src/tickets.js';
import {companyScope,AccessDenied} from '../../infrastructure/access.js';
import {auditActorNames,auditActorLabel} from '../../infrastructure/audit-actors.js';
import {technicalManagementContext,technicalTeamAuthority,technicalAssignmentAllowed} from './access.js';
import {Membership,Role,User} from '../identity/models.js';
import {Equipment,Party,Property} from '../relationships/models.js';
import {locationNames} from '../relationships/locations.js';
import {Region,Portfolio} from '../territories/models.js';
import {CatalogProduct} from '../catalog/models.js';
import {FieldExecution} from '../field-visits/models.js';
import {OfflineVisitReport} from '../offline/models.js';
import {Ticket,TicketEvent} from '../tickets/models.js';
import {RecordNotFound,RecordConflict} from '../relationships/service.js';
import {objectId} from '../relationships/input.js';
import {dayBoundary,wallTimeToInstant} from '../agenda/recurrence.js';
import {addCalendarDays} from '../../../../../packages/contracts/src/agenda.js';
import {TechnicalWork,TechnicalAudit,WorkOrderSequence,WorkOrderPart} from './models.js';
import {technicalOptionsInput,technicalListInput,technicalCreateInput,technicalCheckIn,technicalCheckOut,technicalClose,technicalOrdersInput,technicalReason,workOrderPartInput,workOrderPartOptionsInput,TechnicalRuleRejected} from './input.js';
import {moveStock} from '../supply/stock.js';
const oid=(id:string)=>new mongoose.Types.ObjectId(id);
const literal=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
async function transact<T>(fn:(session:mongoose.ClientSession)=>Promise<T>){try{return await mongoose.connection.transaction(fn);}catch(error){if((error as {code?:number}).code===11000)throw new RecordConflict();throw error;}}
function manager(ctx:AccessContext,company:string){const scope=companyScope(ctx,company,'technical:manage');if(!ctx.dataAccess||!['company','team'].includes(ctx.dataAccess.visibility))throw new AccessDenied();return scope;}
async function portfolioRegion(party:InstanceType<typeof Party>,session?:mongoose.ClientSession){
 if(!party.portfolioId)return null;
 const portfolio=await Portfolio.findOne({_id:party.portfolioId,tenantId:party.tenantId,companyId:party.companyId,ownerId:party.ownerId,active:true}).session(session??null);if(!portfolio)throw new TechnicalRuleRejected();
 if(!portfolio.regionId)return null;
 if(!await Region.exists({_id:portfolio.regionId,tenantId:party.tenantId,companyId:party.companyId,active:true}).session(session??null))throw new TechnicalRuleRejected();
 return String(portfolio.regionId);
}
/** Territory of the work: the property region for work orders; the portfolio region for appointments created before them. */
async function regionOfWork(propertyId:unknown,party:InstanceType<typeof Party>,session?:mongoose.ClientSession){
 if(!propertyId)return portfolioRegion(party,session);
 const property=await Property.findOne({_id:propertyId,tenantId:party.tenantId,companyId:party.companyId,partyId:party._id}).session(session??null);if(!property)throw new TechnicalRuleRejected();
 if(!property.regionId)return null;
 if(!await Region.exists({_id:property.regionId,tenantId:party.tenantId,companyId:party.companyId,active:true}).session(session??null))throw new TechnicalRuleRejected();
 return String(property.regionId);
}
async function assignee(ctx:AccessContext,company:string,id:string,regionId:string|null,session:mongoose.ClientSession){
 const roles=await Role.find({tenantId:ctx.tenantId,key:'technician'}).session(session);
 const member=await Membership.findOne({tenantId:ctx.tenantId,userId:id,companyIds:company,active:true,roleIds:{$in:roles.map(role=>role._id)}}).session(session);
 if(!member||!await User.exists({_id:id,active:true}).session(session)||regionId&&!member.regionIds.some(region=>String(region)===regionId))throw new TechnicalRuleRejected();
 await Membership.updateOne({_id:member._id,tenantId:ctx.tenantId},{$inc:{commercialRevision:1}},{session});return member;
}
/** Scope before counts: assigned technician, live team and territory (property region, or portfolio for legacy rows), or company. */
export async function pipeline(ctx:AccessContext,company:string,extra:Record<string,unknown>={},session?:mongoose.ClientSession){
 const scope=companyScope(ctx,company,'technical:read');if(!ctx.dataAccess)throw new AccessDenied();
 const ids={tenantId:oid(scope.tenantId),companyId:oid(company)},filter:Record<string,unknown>={...ids,...extra};let regions:mongoose.Types.ObjectId[]|null=null;
 if(ctx.dataAccess.visibility==='own')filter.technicianId=oid(ctx.userId);
 if(ctx.dataAccess.visibility==='team'){const authority=await technicalTeamAuthority(ctx,company,session);regions=authority!.regionIds;filter.technicianId={$in:authority!.technicianIds};}
 const stages:mongoose.PipelineStage[]=[{$match:filter},{$lookup:{from:Party.collection.name,localField:'partyId',foreignField:'_id',pipeline:[{$match:{...ids,archived:false}}],as:'party'}},{$unwind:'$party'}];
 if(regions)stages.push(
  {$lookup:{from:Property.collection.name,localField:'propertyId',foreignField:'_id',pipeline:[{$match:ids},{$project:{regionId:1}}],as:'workProperty'}},
  {$lookup:{from:Portfolio.collection.name,localField:'party.portfolioId',foreignField:'_id',pipeline:[{$match:{...ids,active:true}},{$project:{regionId:1,ownerId:1}}],as:'portfolio'}},
  {$match:{$or:[{'workProperty.regionId':{$in:regions}},{'workProperty.0':{$exists:false},$expr:{$and:[{$gt:[{$size:'$portfolio'},0]},{$in:[{$arrayElemAt:['$portfolio.regionId',0]},regions]},{$eq:[{$arrayElemAt:['$portfolio.ownerId',0]},'$party.ownerId']}]}}]}});
 return stages;
}
async function load(ctx:AccessContext,company:string,id:string,session?:mongoose.ClientSession){
 objectId.parse(id);const [visible]=await TechnicalWork.aggregate(await pipeline(ctx,company,{_id:oid(id)},session)).session(session??null);if(!visible)throw new RecordNotFound();
 const row=await TechnicalWork.findOne({_id:id,tenantId:ctx.tenantId,companyId:company}).session(session??null),party=await Party.findOne({_id:visible.party._id,tenantId:ctx.tenantId,companyId:company,archived:false}).session(session??null);
 if(!row||!party)throw new RecordNotFound();return {row,party};
}
/** Parts may be registered while executing or after execution until coordination closes the work order. */
function canRegisterParts(ctx:AccessContext,row:InstanceType<typeof TechnicalWork>,canManage:boolean){
 if(row.closedAt||!['in_progress','completed'].includes(row.state))return false;
 return canManage||String(row.technicianId)===ctx.userId&&ctx.permissions.includes('technical:write');
}
/** Net quantities per product from the immutable ledger; reference totals only for catalog readers. */
async function partsSummary(ctx:AccessContext,row:InstanceType<typeof TechnicalWork>,session?:mongoose.ClientSession):Promise<WorkOrderPartSummary[]>{
 const entries=await WorkOrderPart.find({tenantId:ctx.tenantId,companyId:row.companyId,workId:row._id}).sort({createdAt:1,_id:1}).session(session??null);
 const prices=ctx.permissions.includes('catalog:read'),groups=new Map<string,{entry:InstanceType<typeof WorkOrderPart>;consumed:number;returned:number;cents:number;priced:boolean}>();
 for(const entry of entries){const key=String(entry.productId),group=groups.get(key)??{entry,consumed:0,returned:0,cents:0,priced:true};const sign=entry.kind==='consumo'?1:-1;
  if(entry.kind==='consumo')group.consumed+=entry.quantityMilli;else group.returned+=entry.quantityMilli;
  if(entry.referencePriceCents===null||entry.referencePriceCents===undefined)group.priced=false;else group.cents+=sign*entry.quantityMilli*entry.referencePriceCents/1000;groups.set(key,group);}
 return [...groups.values()].map(({entry,consumed,returned,cents,priced})=>({productId:String(entry.productId),code:entry.code,description:entry.description,unit:entry.unit,consumed:milliToQuantity(consumed,entry.quantityDecimals),returned:milliToQuantity(returned,entry.quantityDecimals),net:milliToQuantity(consumed-returned,entry.quantityDecimals),referenceTotalCents:prices&&priced?Math.round(cents):null}));
}
/** Server-side reference price snapshot for the work order's own customer. The actor never sees it without catalog:read. */
async function referencePrice(ctx:AccessContext,company:string,party:InstanceType<typeof Party>,productId:string){
 // Internal read on an already authorized customer: resolve needs catalog/customer read at company level, which technicians lack.
 const internal:AccessContext={...ctx,permissions:[...new Set([...ctx.permissions,'catalog:read','customer:read'] as const)],dataAccess:{...ctx.dataAccess!,visibility:'company',supervisedUserIds:[]}};
 try{return (await catalogService.resolve(internal,company,{customerId:String(party._id),productId})).price?.priceCents??null;}catch{return null;}
}
async function view(ctx:AccessContext,row:InstanceType<typeof TechnicalWork>,party:InstanceType<typeof Party>):Promise<TechnicalWorkView>{
 const company=String(row.companyId);
 const [techNames,service,names,ticket,original]=await Promise.all([auditActorNames(ctx.tenantId,[String(row.technicianId)]),CatalogProduct.findOne({_id:row.serviceId,tenantId:ctx.tenantId,companyId:row.companyId}).select('description'),locationNames(ctx,company,[{propertyId:row.propertyId,equipmentId:row.equipmentId}]),row.ticketId?Ticket.findOne({_id:row.ticketId,tenantId:ctx.tenantId,companyId:row.companyId}).select('number'):null,row.returnOfWorkId?TechnicalWork.findOne({_id:row.returnOfWorkId,tenantId:ctx.tenantId,companyId:row.companyId}).select('number'):null]);
 const pos=(value:any)=>value?{latitude:value.latitude,longitude:value.longitude,accuracy:value.accuracy}:null,property=row.propertyId?names.property.get(String(row.propertyId)):undefined;
 const canManage=(!ctx.dataAccess?.technicalManagementVisibility||ctx.dataAccess.technicalManagementVisibility===ctx.dataAccess.visibility)&&ctx.permissions.includes('technical:manage')&&['company','team'].includes(ctx.dataAccess?.visibility??'');
 return {id:String(row._id),partyId:String(row.partyId),partyName:party.name,address:property?.address||[party.address?.street,party.address?.number,party.address?.city,party.address?.state].filter(Boolean).join(', '),serviceId:String(row.serviceId),serviceName:service?.description??'Serviço indisponível',technicianId:String(row.technicianId),technicianName:techNames.get(String(row.technicianId))??'Técnico indisponível',title:row.title,startAt:row.startAt.toISOString(),endAt:row.endAt.toISOString(),notes:row.notes,state:row.state,version:row.version,result:row.result,reason:row.reason,checkedInAt:row.checkedInAt?.toISOString()??null,checkedOutAt:row.checkedOutAt?.toISOString()??null,interruptedAt:row.interruptedAt?.toISOString()??null,checkIn:pos(row.checkIn),checkOut:pos(row.checkOut),canExecute:String(row.technicianId)===ctx.userId&&ctx.permissions.includes('technical:write'),canManage,
  number:row.number??'',origin:(row.origin??'manual') as TechnicalWorkView['origin'],ticketId:row.ticketId?String(row.ticketId):null,ticketNumber:ticket?.number??'',propertyId:row.propertyId?String(row.propertyId):null,propertyName:property?.name??(row.propertyId?'Propriedade indisponível':''),regionName:property?.regionName??'',equipmentId:row.equipmentId?String(row.equipmentId):null,equipmentName:row.equipmentId?names.equipment.get(String(row.equipmentId))??'Equipamento indisponível':'',returnOfWorkId:row.returnOfWorkId?String(row.returnOfWorkId):null,returnOfNumber:original?.number??'',
  parts:await partsSummary(ctx,row),canRegisterParts:canRegisterParts(ctx,row,canManage),
  diagnosis:row.diagnosis??'',solution:row.solution??'',attendanceMinutes:row.checkedInAt?elapsedMinutes(row.checkedInAt,row.checkedOutAt??null):null,laborMinutes:row.laborMinutes??null,travelMinutes:row.travelMinutes??null,travelKm:row.travelKm??null,billableMinutes:row.billableMinutes??null,closedAt:row.closedAt?.toISOString()??null,closingNote:row.closingNote??'',canClose:canManage&&row.state==='completed'&&!row.closedAt};
}
async function audit(ctx:AccessContext,company:string,id:unknown,action:string,session:mongoose.ClientSession,reason=''){await TechnicalAudit.create([{...companyScope(ctx,company,'technical:read'),workId:id,actorId:ctx.userId,action,reason}],{session});}
export const technicalService={
 async list(ctx:AccessContext,company:string,raw:unknown){
  const input=technicalListInput.parse(raw),start=dayBoundary(input.date,'America/Sao_Paulo'),end=dayBoundary(addCalendarDays(input.date,1),'America/Sao_Paulo');
  const stages=await pipeline(ctx,company,{$or:[{startAt:{$gte:start,$lt:end}},{state:'in_progress'}]});
  const [result]=await TechnicalWork.aggregate([...stages,{$facet:{items:[{$sort:{startAt:1,_id:1}},{$skip:(input.page-1)*20},{$limit:20}],total:[{$count:'value'}]}}]);
  const items=[];for(const row of result?.items??[]){const loaded=await load(ctx,company,String(row._id));items.push(await view(ctx,loaded.row,loaded.party));}
  return {items,total:result?.total[0]?.value??0,page:input.page};
 },
 /** Work orders of a ticket, customer or equipment, within the same technical scope. */
 async orders(ctx:AccessContext,company:string,raw:unknown){
  const input=technicalOrdersInput.parse(raw);
  const stages=await pipeline(ctx,company,{...(input.ticketId?{ticketId:oid(input.ticketId)}:{}),...(input.partyId?{partyId:oid(input.partyId)}:{}),...(input.equipmentId?{equipmentId:oid(input.equipmentId)}:{})});
  const [result]=await TechnicalWork.aggregate([...stages,{$facet:{items:[{$sort:{startAt:-1,_id:-1}},{$skip:(input.page-1)*20},{$limit:20}],total:[{$count:'value'}]}}]);
  const items=[];for(const row of result?.items??[]){const loaded=await load(ctx,company,String(row._id));items.push(await view(ctx,loaded.row,loaded.party));}
  return {items,total:result?.total[0]?.value??0,page:input.page};
 },
 async detail(ctx:AccessContext,company:string,id:string){
  const {row,party}=await load(ctx,company,id);
  const events=await TechnicalAudit.find({...companyScope(ctx,company,'technical:read'),workId:id}).sort({createdAt:-1,_id:-1}).limit(30);
  const names=await auditActorNames(ctx.tenantId,events.map(event=>String(event.actorId)));
  return {record:await view(ctx,row,party),history:events.map(event=>({action:event.action,actor:auditActorLabel(names,String(event.actorId),ctx.userId),at:event.createdAt.toISOString(),reason:event.reason}))};
 },
 async parts(ctx:AccessContext,company:string,id:string){
  const {row}=await load(ctx,company,id);
  const entries=await WorkOrderPart.find({tenantId:ctx.tenantId,companyId:company,workId:row._id}).sort({createdAt:-1,_id:-1}).limit(500);
  const names=await auditActorNames(ctx.tenantId,entries.map(entry=>String(entry.actorId))),prices=ctx.permissions.includes('catalog:read');
  const items:WorkOrderPartView[]=entries.map(entry=>({id:String(entry._id),productId:String(entry.productId),code:entry.code,description:entry.description,unit:entry.unit,kind:entry.kind as WorkOrderPartView['kind'],quantity:milliToQuantity(entry.quantityMilli,entry.quantityDecimals),note:entry.note,actor:auditActorLabel(names,String(entry.actorId),ctx.userId),at:entry.createdAt.toISOString(),referencePriceCents:prices?entry.referencePriceCents??null:null}));
  return {items,summary:await partsSummary(ctx,row)};
 },
 /** Catalog products for the parts editor, limited to people who may register parts on this work order. */
 async partOptions(ctx:AccessContext,company:string,id:string,raw:unknown){
  const {search}=workOrderPartOptionsInput.parse(raw),{row,party}=await load(ctx,company,id);
  if(!canRegisterParts(ctx,row,(await view(ctx,row,party)).canManage))throw new AccessDenied();
  const filter=search?{$or:[{description:{$regex:literal(search),$options:'i'}},{code:{$regex:literal(search),$options:'i'}},{manufacturerSku:{$regex:literal(search),$options:'i'}}]}:{};
  const rows=await CatalogProduct.find({tenantId:ctx.tenantId,companyId:company,kind:'product',active:true,...filter}).select('code description unit quantityDecimals').sort({description:1}).limit(30);
  return {items:rows.map(product=>({id:String(product._id),code:product.code,description:product.description,unit:product.unit,quantityDecimals:product.quantityDecimals}))};
 },
 async addPart(ctx:AccessContext,company:string,id:string,raw:unknown){
  const input=workOrderPartInput.parse(raw);
  return transact(async session=>{
   const {row,party}=await load(ctx,company,id,session);
   const canManage=(await view(ctx,row,party)).canManage;if(!canRegisterParts(ctx,row,canManage))throw new AccessDenied();
   // Serializes ledger writes per work order without touching the version used by execution actions.
   await TechnicalWork.updateOne({_id:row._id,tenantId:ctx.tenantId,companyId:company},{$inc:{partsRevision:1}},{session});
   const product=await CatalogProduct.findOne({_id:input.productId,tenantId:ctx.tenantId,companyId:company,kind:'product',active:true}).session(session);if(!product)throw new TechnicalRuleRejected();
   if(!decimalQuantityValid(input.quantity,product.quantityDecimals))throw new TechnicalRuleRejected();
   const quantityMilli=quantityToMilli(input.quantity);
   if(input.kind==='devolucao'){const net=(await WorkOrderPart.find({tenantId:ctx.tenantId,companyId:company,workId:row._id,productId:product._id}).session(session)).reduce((sum,entry)=>sum+(entry.kind==='consumo'?entry.quantityMilli:-entry.quantityMilli),0);if(quantityMilli>net)throw new TechnicalRuleRejected();}
   const [entry]=await WorkOrderPart.create([{tenantId:ctx.tenantId,companyId:company,workId:row._id,productId:product._id,code:product.code,description:product.description,unit:product.unit,quantityDecimals:product.quantityDecimals,kind:input.kind,quantityMilli,note:input.note,actorId:ctx.userId,referencePriceCents:await referencePrice(ctx,company,party,String(product._id))}],{session});
   await moveStock(ctx,company,{productId:product._id,direction:input.kind==='consumo'?'saida':'entrada',quantityMilli,source:'os',sourceKey:'os-part:'+String(entry!._id),reference:row.number??'OS',referenceId:row._id,note:input.note,allowNegative:true},session);
   await audit(ctx,company,row._id,'technical.part',session,(input.kind==='consumo'?'Consumo':'Devolução')+' de '+input.quantity+' '+product.unit+' — '+product.code+' '+product.description);
   return {id:String(entry!._id)};
  });
 },
 async options(ctx:AccessContext,company:string,raw:unknown){
  ctx=technicalManagementContext(ctx);const scope=manager(ctx,company),{search,page,partyId}=technicalOptionsInput.parse(raw),authority=await technicalTeamAuthority(ctx,company);
  const ids={tenantId:oid(ctx.tenantId),companyId:oid(company)};
  if(partyId){
   const [properties,equipment]=await Promise.all([Property.find({tenantId:ctx.tenantId,companyId:company,partyId,archived:false,...(authority?{regionId:{$in:authority.regionIds}}:{})}).select('name').sort({name:1}).limit(200),Equipment.find({tenantId:ctx.tenantId,companyId:company,partyId,archived:false}).select('brand model serialNumber propertyId').limit(500)]);
   return {properties:properties.map(row=>({id:String(row._id),name:row.name})),equipment:equipment.map(row=>({id:String(row._id),propertyId:String(row.propertyId),name:[row.brand,row.model,row.serialNumber&&'série '+row.serialNumber].filter(Boolean).join(' ')})),customers:[],technicians:[],services:[]};
  }
  const filter=search?{name:{$regex:literal(search),$options:'i'}}:{};
  const roles=await Role.find({tenantId:ctx.tenantId,key:'technician'}),members=await Membership.find({tenantId:ctx.tenantId,companyIds:company,active:true,roleIds:{$in:roles.map(role=>role._id)},...(authority?{userId:{$in:authority.technicianIds}}:{})});
  const stages:mongoose.PipelineStage[]=[{$match:{...ids,kind:'customer',qualificationState:'approved',archived:false,...filter}}];
  // Coordination schedules maintenance for customers with a property in its live territories.
  if(authority)stages.push({$lookup:{from:Property.collection.name,localField:'_id',foreignField:'partyId',pipeline:[{$match:{...ids,archived:false,regionId:{$in:authority.regionIds}}},{$project:{_id:1}}],as:'territoryProperties'}},{$match:{'territoryProperties.0':{$exists:true}}});
  const [customers,technicians,services]=await Promise.all([Party.aggregate([...stages,{$sort:{name:1,_id:1}},{$skip:(page-1)*30},{$limit:30},{$project:{_id:1,name:1}}]),User.find({_id:{$in:members.map(member=>member.userId)},active:true,...filter}).sort({name:1}).skip((page-1)*30).limit(30),CatalogProduct.find({...scope,kind:'service',active:true,...(search?{description:{$regex:literal(search),$options:'i'}}:{})}).select('description').sort({description:1}).skip((page-1)*30).limit(30)]);
  return {customers:customers.map(row=>({id:String(row._id),name:row.name})),technicians:technicians.map(row=>({id:String(row._id),name:row.name})),services:services.map(row=>({id:String(row._id),name:row.description})),properties:[],equipment:[]};
 },
 async create(ctx:AccessContext,company:string,raw:unknown){
  ctx=technicalManagementContext(ctx);const scope=manager(ctx,company),input=technicalCreateInput.parse(raw),startAt=wallTimeToInstant(input.startLocal,'America/Sao_Paulo'),endAt=new Date(startAt.valueOf()+input.durationMinutes*60000);
  if(startAt.valueOf()<Date.now()-60000)throw new TechnicalRuleRejected();
  return transact(async session=>{
   // From a ticket, customer and location come from the ticket; otherwise the property is explicit.
   const ticket=input.ticketId?await Ticket.findOne({_id:input.ticketId,...scope,status:{$in:['aberto','em_atendimento','aguardando_cliente']}}).session(session):null;
   if(input.ticketId&&!ticket)throw new RecordNotFound();
   const partyId=ticket?String(ticket.partyId):input.partyId!,propertyId=ticket?String(ticket.propertyId):input.propertyId!,equipmentId=ticket?(ticket.equipmentId?String(ticket.equipmentId):null):input.equipmentId??null;
   if(ticket&&input.partyId&&input.partyId!==partyId)throw new TechnicalRuleRejected();
   const party=await Party.findOne({...scope,_id:partyId,kind:'customer',qualificationState:'approved',archived:false}).session(session);if(!party)throw new RecordNotFound();
   if(!await Property.exists({_id:propertyId,...scope,partyId,archived:false}).session(session))throw new TechnicalRuleRejected();
   if(equipmentId&&!await Equipment.exists({_id:equipmentId,...scope,partyId,propertyId,archived:false}).session(session))throw new TechnicalRuleRejected();
   if(input.returnOfWorkId&&!await TechnicalWork.exists({_id:input.returnOfWorkId,...scope,partyId,state:'completed'}).session(session))throw new TechnicalRuleRejected();
   if(!await CatalogProduct.exists({...scope,_id:input.serviceId,kind:'service',active:true}).session(session))throw new TechnicalRuleRejected();
   const region=await regionOfWork(propertyId,party,session),authority=await technicalTeamAuthority(ctx,company,session);
   if(!technicalAssignmentAllowed(authority,input.technicianId,region))throw new AccessDenied();
   await assignee(ctx,company,input.technicianId,region,session);
   await User.updateOne({_id:input.technicianId,active:true},{$inc:{fieldRevision:1}},{session});await Party.updateOne({_id:party._id,...scope},{$inc:{commercialRevision:1}},{session});
   if(await TechnicalWork.exists({...scope,technicianId:input.technicianId,state:{$in:['pending','in_progress']},startAt:{$lt:endAt},endAt:{$gt:startAt}}).session(session))throw new RecordConflict();
   const sequence=await WorkOrderSequence.findOneAndUpdate(scope,{$inc:{value:1}},{upsert:true,new:true,session,setDefaultsOnInsert:true});
   const [row]=await TechnicalWork.create([{...scope,number:'OS-'+String(sequence!.value).padStart(6,'0'),origin:ticket?'chamado':'programada',ticketId:ticket?._id??null,partyId,propertyId,equipmentId,returnOfWorkId:input.returnOfWorkId??null,serviceId:input.serviceId,technicianId:input.technicianId,title:input.title,notes:input.notes,startAt,endAt}],{session});
   if(ticket){
    const moved=await Ticket.updateOne({_id:ticket._id,...scope,version:ticket.version},{$set:{status:ticket.status==='aberto'?'em_atendimento':ticket.status},$inc:{version:1}},{session});if(moved.modifiedCount!==1)throw new RecordConflict();
    await TicketEvent.create([{...scope,ticketId:ticket._id,actorId:ctx.userId,action:'work_order_created',note:row!.number+' — '+row!.title,statusAfter:ticket.status==='aberto'?'em_atendimento':ticket.status}],{session});
   }
   await audit(ctx,company,row!._id,'technical.created',session);return {id:String(row!._id),number:row!.number};
  });
 },
 async act(ctx:AccessContext,company:string,id:string,action:'check-in'|'check-out'|'cancel'|'interrupt'|'close',raw:unknown){
  const managing=['cancel','interrupt','close'].includes(action);if(managing)ctx=technicalManagementContext(ctx);
  const input=action==='check-in'?technicalCheckIn.parse(raw):action==='check-out'?technicalCheckOut.parse(raw):action==='close'?technicalClose.parse(raw):technicalReason.parse(raw);
  companyScope(ctx,company,managing?'technical:manage':'technical:write');if(managing)manager(ctx,company);
  return transact(async session=>{
   const {row,party}=await load(ctx,company,id,session);if(row.version!==input.version)throw new RecordConflict();
   await Party.updateOne({_id:party._id,tenantId:ctx.tenantId,companyId:company},{$inc:{commercialRevision:1}},{session});const now=new Date();
   if(action==='check-in'||action==='check-out'){if(String(row.technicianId)!==ctx.userId)throw new AccessDenied();await assignee(ctx,company,ctx.userId,action==='check-in'?await regionOfWork(row.propertyId,party,session):null,session);await User.updateOne({_id:ctx.userId,active:true},{$inc:{fieldRevision:1}},{session});}
   if(action==='check-in'){
    if(row.state!=='pending'||party.qualificationState!=='approved'||!await CatalogProduct.exists({_id:row.serviceId,tenantId:ctx.tenantId,companyId:company,kind:'service',active:true}).session(session))throw new TechnicalRuleRejected();
    if(await FieldExecution.exists({actorId:ctx.userId,state:'in_progress'}).session(session)||await TechnicalWork.exists({technicianId:ctx.userId,state:'in_progress'}).session(session)||await OfflineVisitReport.exists({userId:ctx.userId,observedInAt:{$lte:now},observedOutAt:{$gt:now}}).session(session))throw new RecordConflict();
    row.state='in_progress';row.checkedInAt=now;row.checkIn=technicalCheckIn.parse(raw).position;row.locationNoticeVersion='technical-1.0';
   }else if(action==='check-out'){
    // Execution data reported by the technician; attendance time comes from server check-in/out, billable hours from closing.
    if(row.state!=='in_progress')throw new TechnicalRuleRejected();const data=technicalCheckOut.parse(raw);
    row.state='completed';row.checkedOutAt=now;row.checkOut=data.position;row.diagnosis=data.diagnosis;row.solution=data.solution;row.result=data.solution;row.laborMinutes=data.laborMinutes;row.travelMinutes=data.travelMinutes;row.travelKm=data.travelKm;
   }else if(action==='close'){
    if(row.state!=='completed'||row.closedAt)throw new TechnicalRuleRejected();const data=technicalClose.parse(raw);
    row.closedAt=now;row.closedBy=new mongoose.Types.ObjectId(ctx.userId);row.billableMinutes=data.billableMinutes;row.closingNote=data.note;row.reason=data.note;
   }else if(action==='cancel'){if(row.state!=='pending')throw new TechnicalRuleRejected();row.state='cancelled';row.cancelledAt=now;row.reason=technicalReason.parse(raw).reason;}
   else{if(row.state!=='in_progress')throw new TechnicalRuleRejected();row.state='interrupted';row.interruptedAt=now;row.reason=technicalReason.parse(raw).reason;}
   row.version++;await row.save({session});await audit(ctx,company,id,'technical.'+action,session,row.reason);return {id,state:row.state};
  });
 },
};
