import mongoose from 'mongoose';
import type {AccessContext,Permission} from '../../../../../packages/contracts/src/index.js';
import {decimalQuantityValid} from '../../../../../packages/contracts/src/catalog.js';
import {proposalLineCents} from '../../../../../packages/contracts/src/opportunities.js';
import {milliToQuantity,quantityToMilli} from '../../../../../packages/contracts/src/technical.js';
import {orderApprovalReasonNames,orderInstallments,orderMargin,type OrderAction,type OrderEventView,type OrderView} from '../../../../../packages/contracts/src/orders.js';
import {dateParts} from '../../../../../packages/contracts/src/agenda.js';
import {companyScope,AccessDenied} from '../../infrastructure/access.js';
import {auditActorLabel,auditActorNames} from '../../infrastructure/audit-actors.js';
import {commercialFilter} from '../identity/profile-access.js';
import {Party} from '../relationships/models.js';
import {objectId} from '../relationships/input.js';
import {RecordConflict,RecordNotFound} from '../relationships/service.js';
import {CatalogProduct} from '../catalog/models.js';
import {catalogService} from '../catalog/service.js';
import {Opportunity,Proposal} from '../opportunities/models.js';
import {authorizeOpportunity,history as opportunityHistory} from '../opportunities/service.js';
import {TechnicalWork,WorkOrderPart} from '../technical/models.js';
import {pipeline as technicalScope} from '../technical/service.js';
import {SalesOrder,SalesOrderEvent,SalesOrderSequence} from './models.js';
import {orderActionInput,orderDirectInput,orderFromProposalInput,orderFromWorkOrderInput,orderInvoiceInput,orderListInput,orderUpdateInput,OrderRuleRejected} from './input.js';
const oid=(id:string)=>new mongoose.Types.ObjectId(id);
const literal=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const today=()=>dateParts(new Date(),'America/Sao_Paulo').date;
const exposureStatuses=['aguardando_aprovacao','confirmado','entregue'];
async function transact<T>(fn:(session:mongoose.ClientSession)=>Promise<T>){try{return await mongoose.connection.transaction(fn);}catch(error){if((error as {code?:number}).code===11000)throw new RecordConflict();throw error;}}
type Line={productId:string;quantity:string;unitPriceCents:number;discountCents:number};
/** Approved customers of the live commercial portfolio; reading uses order:read, writing order:write. */
function partyFilter(ctx:AccessContext,companyId:string,permission:Permission,extra:Record<string,unknown>={}){return commercialFilter(ctx,companyId,permission,{kind:'customer',...extra});}
/** Order kinds a profile works with: order:sales (venda) and/or order:service (serviço). */
export function orderKinds(ctx:AccessContext){return [...(ctx.permissions.includes('order:sales')?['venda']:[]),...(ctx.permissions.includes('order:service')?['servico']:[])];}
/** Live scope of orders before any count: kind permission, then the customer portfolio (commercial and finance profiles)
 * or, for technical coordination without customer access, the work orders of its technical scope. */
export async function orderScope(ctx:AccessContext,companyId:string,permission:Permission,partyExtra:Record<string,unknown>={}){
 const scope=companyScope(ctx,companyId,permission),kinds=orderKinds(ctx);if(!kinds.length)throw new AccessDenied();
 const match:Record<string,unknown>={tenantId:oid(scope.tenantId),companyId:oid(companyId),kind:{$in:kinds}};
 let parties:Record<string,unknown>;
 if(ctx.permissions.includes('customer:read')){const query=Party.find(partyFilter(ctx,companyId,permission,partyExtra));query.cast(Party);parties=query.getFilter();}
 else if(ctx.permissions.includes('technical:read')&&permission==='order:read'){
  const works=await TechnicalWork.aggregate([...await technicalScope(ctx,companyId),{$project:{_id:1}}]);
  match.workOrderId={$in:works.map(item=>item._id)};const query=Party.find({tenantId:scope.tenantId,companyId,...partyExtra});query.cast(Party);parties=query.getFilter();
 }else throw new AccessDenied();
 return {match,parties};
}
function assertKind(ctx:AccessContext,kind:string){if(!orderKinds(ctx).includes(kind))throw new OrderRuleRejected('KIND_NOT_ALLOWED');}
async function approvedParty(ctx:AccessContext,companyId:string,partyId:unknown,session:mongoose.ClientSession){
 const party=await Party.findOne(partyFilter(ctx,companyId,'order:write',{_id:partyId,archived:false,qualificationState:'approved'})).session(session);
 if(!party)throw new OrderRuleRejected('CUSTOMER_NOT_APPROVED');
 await Party.updateOne({_id:party._id,tenantId:ctx.tenantId,companyId},{$inc:{commercialRevision:1}},{session});return party;
}
/** Reference price from the customer's tables, read by the server; never accepted from the browser. */
async function referencePrice(ctx:AccessContext,companyId:string,partyId:unknown,productId:string){
 if(!ctx.permissions.includes('catalog:read'))return null;
 try{return (await catalogService.resolve(ctx,companyId,{customerId:String(partyId),productId})).price?.priceCents??null;}catch{return null;}
}
async function buildItems(ctx:AccessContext,companyId:string,partyId:unknown,lines:Line[],session:mongoose.ClientSession){
 const products=new Map((await CatalogProduct.find({tenantId:ctx.tenantId,companyId,_id:{$in:lines.map(line=>line.productId)},active:true}).session(session)).map(row=>[String(row._id),row]));
 const items=[];
 for(const line of lines){
  const product=products.get(line.productId);if(!product)throw new OrderRuleRejected('INVALID_PRODUCT');
  if(!decimalQuantityValid(line.quantity,product.quantityDecimals))throw new OrderRuleRejected('INVALID_QUANTITY');
  let totalCents:number;try{totalCents=proposalLineCents(line.quantity,line.unitPriceCents,line.discountCents);}catch{throw new OrderRuleRejected('INVALID_LINE');}
  items.push({productId:product._id,code:product.code,description:product.description,kind:product.kind,unit:product.unit,quantity:line.quantity,unitPriceCents:line.unitPriceCents,discountCents:line.discountCents,referencePriceCents:await referencePrice(ctx,companyId,partyId,line.productId),totalCents,costCents:null});
 }
 return {items,totalCents:items.reduce((sum,item)=>sum+item.totalCents,0),kind:items.every(item=>item.kind==='service')?'servico':'venda'};
}
async function event(ctx:AccessContext,companyId:string,orderId:unknown,action:string,session:mongoose.ClientSession,note=''){await SalesOrderEvent.create([{tenantId:ctx.tenantId,companyId,orderId,actorId:ctx.userId,action,note}],{session});}
async function nextNumber(ctx:AccessContext,companyId:string,session:mongoose.ClientSession){const sequence=await SalesOrderSequence.findOneAndUpdate({tenantId:ctx.tenantId,companyId},{$inc:{value:1}},{upsert:true,new:true,session,setDefaultsOnInsert:true});return 'PV-'+String(sequence!.value).padStart(6,'0');}
async function view(ctx:AccessContext,row:InstanceType<typeof SalesOrder>,partyName:string):Promise<OrderView>{
 const [proposal,work,names]=await Promise.all([row.proposalId?Proposal.findOne({_id:row.proposalId,tenantId:ctx.tenantId}).select('number'):null,row.workOrderId?TechnicalWork.findOne({_id:row.workOrderId,tenantId:ctx.tenantId}).select('number'):null,auditActorNames(ctx.tenantId,[...(row.approvedBy?[String(row.approvedBy)]:[]),...row.invoices.map(item=>String(item.registeredBy))])]);
 const costs=ctx.permissions.includes('cost:read'),frozen=row.status!=='rascunho'&&row.status!=='aguardando_aprovacao'&&row.status!=='cancelado',remaining=row.totalCents-row.invoicedCents,write=ctx.permissions.includes('order:write');
 const margin=costs&&frozen?orderMargin(row.totalCents,row.items.map(item=>item.costCents??null)):null;
 return {id:String(row._id),number:row.number,kind:row.kind as OrderView['kind'],origin:row.origin as OrderView['origin'],partyId:String(row.partyId),partyName,opportunityId:row.opportunityId?String(row.opportunityId):null,proposalId:row.proposalId?String(row.proposalId):null,proposalNumber:proposal?.number??'',workOrderId:row.workOrderId?String(row.workOrderId):null,workOrderNumber:work?.number??'',
  status:row.status as OrderView['status'],items:row.items.map(item=>({productId:String(item.productId),code:item.code,description:item.description,kind:item.kind as 'product'|'service',unit:item.unit,quantity:item.quantity,unitPriceCents:item.unitPriceCents,discountCents:item.discountCents,referencePriceCents:item.referencePriceCents??null,totalCents:item.totalCents,...(costs?{costCents:item.costCents??null}:{})})),
  totalCents:row.totalCents,paymentMethod:row.paymentMethod,paymentTermDays:[...row.paymentTermDays],expectedDeliveryDate:row.expectedDeliveryDate,notes:row.notes,approvalReasons:[...row.approvalReasons] as OrderView['approvalReasons'],decisionNote:row.decisionNote,
  submittedAt:row.submittedAt?.toISOString()??null,confirmedAt:row.confirmedAt?.toISOString()??null,approvedBy:row.approvedBy?names.get(String(row.approvedBy))??'Usuário indisponível':'',deliveredAt:row.deliveredAt?.toISOString()??null,invoicedAt:row.invoicedAt?.toISOString()??null,cancelledAt:row.cancelledAt?.toISOString()??null,
  invoices:row.invoices.map(item=>({number:item.number,issueDate:item.issueDate,amountCents:item.amountCents,registeredBy:names.get(String(item.registeredBy))??'Usuário indisponível',registeredAt:item.registeredAt.toISOString()})),invoicedCents:row.invoicedCents,remainingCents:remaining,
  installments:frozen?orderInstallments(row.totalCents,row.invoices[0]?.issueDate??row.expectedDeliveryDate,[...row.paymentTermDays]):[],
  ...(margin?margin:{}),
  canEdit:row.status==='rascunho'&&write,canSubmit:row.status==='rascunho'&&write,canApprove:row.status==='aguardando_aprovacao'&&ctx.permissions.includes('order:approve')&&String(row.submittedBy)!==ctx.userId,
  canDeliver:['confirmado','faturado'].includes(row.status)&&!row.deliveredAt&&write,canInvoice:['confirmado','entregue'].includes(row.status)&&remaining>0&&ctx.permissions.includes('billing:write'),
  canCancel:['rascunho','aguardando_aprovacao','confirmado'].includes(row.status)&&!row.invoices.length&&(write||ctx.permissions.includes('order:approve')),version:row.version,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()};
}
async function load(ctx:AccessContext,companyId:string,id:string,permission:Permission,session?:mongoose.ClientSession){
 objectId.parse(id);const scope=await orderScope(ctx,companyId,permission);
 const row=await SalesOrder.findOne({...scope.match,_id:id}).session(session??null);if(!row)throw new RecordNotFound();
 const party=await Party.findOne({$and:[scope.parties,{_id:row.partyId}]}).select('name commercial version').session(session??null);if(!party)throw new RecordNotFound();
 return {row,party};
}
/** Credit, discount and payment rules decide whether the order needs approval; confirmation freezes unit costs. */
async function evaluate(ctx:AccessContext,companyId:string,row:InstanceType<typeof SalesOrder>,party:InstanceType<typeof Party>,session:mongoose.ClientSession){
 const reasons:string[]=[];
 if(row.items.some(item=>item.referencePriceCents!==null&&item.referencePriceCents!==undefined&&item.totalCents<Math.round(quantityToMilli(item.quantity)*item.referencePriceCents/1000)))reasons.push('discount');
 const allowedTerms=party.commercial?.paymentTermDays??[],allowedMethods=party.commercial?.paymentMethods??[];
 if(!(allowedMethods as string[]).includes(row.paymentMethod)||row.paymentTermDays.some(days=>!allowedTerms.includes(days)))reasons.push('payment');
 if(row.paymentTermDays.some(days=>days>0)){
  const open=await SalesOrder.aggregate([{$match:{tenantId:oid(ctx.tenantId),companyId:oid(companyId),partyId:row.partyId,_id:{$ne:row._id},status:{$in:exposureStatuses}}},{$group:{_id:null,total:{$sum:{$subtract:['$totalCents','$invoicedCents']}}}}]).session(session);
  if((open[0]?.total??0)+row.totalCents>(party.commercial?.creditLimitCents??0))reasons.push('credit');
 }
 const products=new Map((await CatalogProduct.find({tenantId:ctx.tenantId,companyId,_id:{$in:row.items.map(item=>item.productId)}}).select('costCents').session(session)).map(item=>[String(item._id),item.costCents??null]));
 for(const item of row.items){const unit=products.get(String(item.productId));item.costCents=unit===null||unit===undefined?null:Math.round(quantityToMilli(item.quantity)*unit/1000);}
 return reasons;
}
/** A deal confirmed from an accepted proposal closes its open opportunity as won, with server time. */
async function winOpportunity(ctx:AccessContext,companyId:string,row:InstanceType<typeof SalesOrder>,session:mongoose.ClientSession){
 if(!row.opportunityId)return;
 const opportunity=await Opportunity.findOne({_id:row.opportunityId,tenantId:ctx.tenantId,companyId,stage:{$in:['descoberta','proposta','negociacao']}}).session(session);if(!opportunity)return;
 await Opportunity.updateOne({_id:opportunity._id,version:opportunity.version},{$set:{stage:'ganha',probability:100,closedAt:new Date(),lossReason:''},$inc:{version:1}},{session});
 await opportunityHistory(ctx,companyId,opportunity._id,opportunity._id,'opportunity.stage_changed',session,{previousStage:opportunity.stage,nextStage:'ganha'},'Pedido '+row.number+' confirmado');
}
export const orderService={
 async list(ctx:AccessContext,companyId:string,raw:unknown){
  const input=orderListInput.parse(raw),scope=await orderScope(ctx,companyId,'order:read',input.partyId?{_id:input.partyId}:{});
  const status=input.status==='all'?{}:input.status==='open'?{status:{$in:['rascunho','aguardando_aprovacao','confirmado','entregue']}}:{status:input.status};
  const [result]=await SalesOrder.aggregate([{$match:{...scope.match,...status,...(input.search?{number:{$regex:literal(input.search),$options:'i'}}:{})}},{$lookup:{from:Party.collection.name,localField:'partyId',foreignField:'_id',pipeline:[{$match:scope.parties},{$project:{name:1}}],as:'party'}},{$unwind:'$party'},{$sort:{createdAt:-1,_id:-1}},{$facet:{total:[{$count:'count'}],items:[{$skip:(input.page-1)*20},{$limit:20}]}}]);
  const items=[];for(const row of result.items)items.push(await view(ctx,SalesOrder.hydrate(row),row.party.name));
  return {items,total:result.total[0]?.count??0,page:input.page,pageSize:20};
 },
 async detail(ctx:AccessContext,companyId:string,id:string){
  const {row,party}=await load(ctx,companyId,id,'order:read');
  const events=await SalesOrderEvent.find({tenantId:ctx.tenantId,companyId,orderId:row._id}).sort({createdAt:1,_id:1}).limit(200);
  const names=await auditActorNames(ctx.tenantId,events.map(item=>String(item.actorId)));
  const history:OrderEventView[]=events.map(item=>({action:item.action,actor:auditActorLabel(names,String(item.actorId),ctx.userId),at:item.createdAt.toISOString(),note:item.note}));
  return {record:await view(ctx,row,party.name),history};
 },
 async createDirect(ctx:AccessContext,companyId:string,raw:unknown){
  const input=orderDirectInput.parse(raw);companyScope(ctx,companyId,'order:write');
  return transact(async session=>{
   const party=await approvedParty(ctx,companyId,input.partyId,session),built=await buildItems(ctx,companyId,party._id,input.items,session);assertKind(ctx,built.kind);
   const [row]=await SalesOrder.create([{tenantId:ctx.tenantId,companyId,number:await nextNumber(ctx,companyId,session),kind:built.kind,origin:'direto',partyId:party._id,items:built.items,totalCents:built.totalCents,paymentMethod:input.paymentMethod,paymentTermDays:input.paymentTermDays,expectedDeliveryDate:input.expectedDeliveryDate,notes:input.notes,createdBy:ctx.userId}],{session});
   await event(ctx,companyId,row!._id,'created',session,'Lançamento direto');return {id:String(row!._id),number:row!.number};
  });
 },
 async createFromProposal(ctx:AccessContext,companyId:string,raw:unknown){
  const input=orderFromProposalInput.parse(raw);companyScope(ctx,companyId,'order:write');
  return transact(async session=>{
   const {row:opportunity}=await authorizeOpportunity(ctx,companyId,input.opportunityId,'pipeline:read',session);
   const proposal=await Proposal.findOne({_id:input.proposalId,tenantId:ctx.tenantId,companyId,opportunityId:opportunity._id,status:'aceita'}).session(session);if(!proposal)throw new OrderRuleRejected('PROPOSAL_NOT_ACCEPTED');
   const party=await approvedParty(ctx,companyId,opportunity.partyId,session);
   const built=await buildItems(ctx,companyId,party._id,proposal.items.map(item=>({productId:String(item.productId),quantity:item.quantity,unitPriceCents:item.unitPriceCents,discountCents:item.discountCents})),session);assertKind(ctx,built.kind);
   const [row]=await SalesOrder.create([{tenantId:ctx.tenantId,companyId,number:await nextNumber(ctx,companyId,session),kind:built.kind,origin:'proposta',partyId:party._id,opportunityId:opportunity._id,proposalId:proposal._id,items:built.items,totalCents:built.totalCents,paymentMethod:input.paymentMethod,paymentTermDays:input.paymentTermDays,expectedDeliveryDate:input.expectedDeliveryDate,notes:input.notes||proposal.notes,createdBy:ctx.userId}],{session});
   await event(ctx,companyId,row!._id,'created',session,'Proposta '+proposal.number+' rev. '+proposal.revision);return {id:String(row!._id),number:row!.number};
  });
 },
 /** Service order from a closed work order: authorized billable hours at the service price plus net parts at their reference price. */
 async createFromWorkOrder(ctx:AccessContext,companyId:string,raw:unknown){
  const input=orderFromWorkOrderInput.parse(raw);companyScope(ctx,companyId,'order:write');assertKind(ctx,'servico');
  return transact(async session=>{
   const work=await TechnicalWork.findOne({_id:input.workOrderId,tenantId:ctx.tenantId,companyId,closedAt:{$ne:null}}).session(session);if(!work)throw new OrderRuleRejected('WORK_ORDER_NOT_CLOSED');
   const party=await approvedParty(ctx,companyId,work.partyId,session),lines:Line[]=[];
   const service=await CatalogProduct.findOne({_id:work.serviceId,tenantId:ctx.tenantId,companyId,active:true}).session(session);
   if(service&&(work.billableMinutes??0)>0){const hours=milliToQuantity(Math.round((work.billableMinutes??0)*1000/60),Math.max(service.quantityDecimals,0));if(decimalQuantityValid(hours,service.quantityDecimals)&&Number(hours)>0)lines.push({productId:String(service._id),quantity:hours,unitPriceCents:await referencePrice(ctx,companyId,party._id,String(service._id))??0,discountCents:0});}
   const entries=await WorkOrderPart.find({tenantId:ctx.tenantId,companyId,workId:work._id}).sort({createdAt:1}).session(session);
   const parts=new Map<string,{milli:number;decimals:number;price:number}>();
   for(const entry of entries){const key=String(entry.productId),current=parts.get(key)??{milli:0,decimals:entry.quantityDecimals,price:0};current.milli+=entry.kind==='consumo'?entry.quantityMilli:-entry.quantityMilli;if(entry.kind==='consumo'&&entry.referencePriceCents!==null&&entry.referencePriceCents!==undefined)current.price=entry.referencePriceCents;parts.set(key,current);}
   for(const [productId,part] of parts)if(part.milli>0)lines.push({productId,quantity:milliToQuantity(part.milli,part.decimals),unitPriceCents:part.price,discountCents:0});
   if(!lines.length)throw new OrderRuleRejected('NOTHING_BILLABLE');
   const built=await buildItems(ctx,companyId,party._id,lines,session);
   const [row]=await SalesOrder.create([{tenantId:ctx.tenantId,companyId,number:await nextNumber(ctx,companyId,session),kind:'servico',origin:'os',partyId:party._id,workOrderId:work._id,items:built.items,totalCents:built.totalCents,paymentMethod:input.paymentMethod,paymentTermDays:input.paymentTermDays,expectedDeliveryDate:input.expectedDeliveryDate,notes:input.notes,createdBy:ctx.userId}],{session});
   await event(ctx,companyId,row!._id,'created',session,'OS '+(work.number??''));return {id:String(row!._id),number:row!.number};
  });
 },
 async update(ctx:AccessContext,companyId:string,id:string,raw:unknown){
  const input=orderUpdateInput.parse(raw);companyScope(ctx,companyId,'order:write');
  return transact(async session=>{
   const {row}=await load(ctx,companyId,id,'order:write',session);if(row.version!==input.version)throw new RecordConflict();if(row.status!=='rascunho')throw new OrderRuleRejected('STATUS');
   const party=await approvedParty(ctx,companyId,row.partyId,session),set:Record<string,unknown>={};
   for(const key of ['expectedDeliveryDate','paymentMethod','paymentTermDays','notes'] as const)if(Object.hasOwn(raw as object,key))set[key]=input[key];
   if(input.items){if(row.origin!=='direto')throw new OrderRuleRejected('ITEMS_FROM_SOURCE');const built=await buildItems(ctx,companyId,party._id,input.items,session);assertKind(ctx,built.kind);Object.assign(set,{items:built.items,totalCents:built.totalCents});}
   const updated=await SalesOrder.findOneAndUpdate({_id:row._id,version:input.version,status:'rascunho'},{$set:set,$inc:{version:1}},{new:true,session,runValidators:true});if(!updated)throw new RecordConflict();
   await event(ctx,companyId,row._id,'updated',session);return view(ctx,updated,party.name);
  });
 },
 async act(ctx:AccessContext,companyId:string,id:string,action:OrderAction,raw:unknown){
  const input=orderActionInput.parse(raw);
  if((action==='reject'||action==='cancel')&&input.note.length<5)throw new OrderRuleRejected('REASON_REQUIRED');
  return transact(async session=>{
   const permission:Permission=action==='approve'||action==='reject'?'order:approve':'order:write';
   const {row,party}=await load(ctx,companyId,id,action==='cancel'&&!ctx.permissions.includes('order:write')?'order:approve':permission,session);
   if(row.version!==input.version)throw new RecordConflict();
   const current=await view(ctx,row,party.name),now=new Date();
   if(action==='submit'){
    if(!current.canSubmit)throw new OrderRuleRejected('STATUS');
    const fresh=await approvedParty(ctx,companyId,row.partyId,session),reasons=await evaluate(ctx,companyId,row,fresh,session);
    row.submittedBy=new mongoose.Types.ObjectId(ctx.userId);row.submittedAt=now;row.approvalReasons=reasons as never;
    if(reasons.length)row.status='aguardando_aprovacao';else{row.status='confirmado';row.confirmedAt=now;await winOpportunity(ctx,companyId,row,session);}
   }else if(action==='approve'){
    if(!current.canApprove)throw new OrderRuleRejected(row.status==='aguardando_aprovacao'?'SELF_APPROVAL':'STATUS');
    row.status='confirmado';row.confirmedAt=now;row.approvedBy=new mongoose.Types.ObjectId(ctx.userId);row.decisionNote=input.note;await winOpportunity(ctx,companyId,row,session);
   }else if(action==='reject'){
    if(!current.canApprove)throw new OrderRuleRejected('STATUS');row.status='rascunho';row.decisionNote=input.note;row.submittedAt=null;
   }else if(action==='deliver'){
    if(!current.canDeliver)throw new OrderRuleRejected('STATUS');row.deliveredAt=now;if(row.status==='confirmado')row.status='entregue';
   }else{
    if(!current.canCancel)throw new OrderRuleRejected('STATUS');row.status='cancelado';row.cancelledAt=now;row.decisionNote=input.note;
   }
   row.version++;await row.save({session});await event(ctx,companyId,row._id,action,session,action==='submit'&&row.approvalReasons.length?'Aprovação necessária: '+row.approvalReasons.map(reason=>orderApprovalReasonNames[reason as keyof typeof orderApprovalReasonNames]).join('; '):input.note);
   return view(ctx,row,party.name);
  });
 },
 /** Invoices are issued by finance outside the CRM and registered here; the order is invoiced when they cover its total. */
 async registerInvoice(ctx:AccessContext,companyId:string,id:string,raw:unknown){
  const input=orderInvoiceInput.parse(raw);companyScope(ctx,companyId,'billing:write');
  if(input.issueDate>today())throw new OrderRuleRejected('FUTURE_INVOICE');
  return transact(async session=>{
   const {row,party}=await load(ctx,companyId,id,'order:read',session);if(row.version!==input.version)throw new RecordConflict();
   if(!['confirmado','entregue'].includes(row.status))throw new OrderRuleRejected('STATUS');
   if(row.invoices.some(item=>item.number===input.number))throw new OrderRuleRejected('DUPLICATE_INVOICE');
   if(row.invoicedCents+input.amountCents>row.totalCents)throw new OrderRuleRejected('INVOICE_ABOVE_TOTAL');
   row.invoices.push({number:input.number,issueDate:input.issueDate,amountCents:input.amountCents,registeredBy:new mongoose.Types.ObjectId(ctx.userId),registeredAt:new Date()});
   row.invoicedCents+=input.amountCents;if(row.invoicedCents===row.totalCents){row.status='faturado';row.invoicedAt=new Date();}
   row.version++;await row.save({session});await event(ctx,companyId,row._id,'invoiced',session,'NF '+input.number+' de '+input.issueDate);
   return view(ctx,row,party.name);
  });
 },
};
