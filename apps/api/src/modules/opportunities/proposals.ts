import mongoose from 'mongoose';
import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import {decimalQuantityValid} from '../../../../../packages/contracts/src/catalog.js';
import {proposalLineCents,type ProposalStatus,type ProposalView,type ProposalRevisionView} from '../../../../../packages/contracts/src/opportunities.js';
import {companyScope} from '../../infrastructure/access.js';
import {CatalogProduct} from '../catalog/models.js';
import {catalogService} from '../catalog/service.js';
import {objectId} from '../relationships/input.js';
import {RecordConflict,RecordNotFound} from '../relationships/service.js';
import {Opportunity,Proposal,ProposalRevision,ProposalSequence} from './models.js';
import {proposalActionInput,proposalCreateInput,proposalUpdateInput} from './input.js';
import {authorizeOpportunity,history,touch,OpportunityRuleRejected} from './service.js';
export class ProposalRuleRejected extends Error {constructor(readonly code:string){super(code);}}
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
async function transact<T>(fn:(session:mongoose.ClientSession)=>Promise<T>){try{return await mongoose.connection.transaction(fn);}catch(error){if((error as {code?:number}).code===11000)throw new RecordConflict();throw error;}}
function view(row:InstanceType<typeof Proposal>):ProposalView{
 return {id:String(row._id),opportunityId:String(row.opportunityId),number:row.number,status:row.status as ProposalStatus,revision:row.revision,validUntil:row.validUntil,expired:['rascunho','enviada'].includes(row.status)&&row.validUntil<today(),
  items:row.items.map(item=>({productId:String(item.productId),code:item.code,description:item.description,kind:item.kind as 'product'|'service',unit:item.unit,quantity:item.quantity,unitPriceCents:item.unitPriceCents,discountCents:item.discountCents,referencePriceCents:item.referencePriceCents??null,totalCents:item.totalCents})),
  totalCents:row.totalCents,notes:row.notes,sentAt:row.sentAt?.toISOString()??null,decidedAt:row.decidedAt?.toISOString()??null,decisionReason:row.decisionReason,version:row.version,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()};
}
/**
 * Writable proposals hang on an open opportunity whose live parent the actor may change.
 * Bumping proposalRevision makes concurrent closure or another proposal write conflict.
 */
async function openOpportunity(ctx:AccessContext,companyId:string,opportunityId:string,session:mongoose.ClientSession){
 companyScope(ctx,companyId,'proposal:write');
 const {row,party}=await authorizeOpportunity(ctx,companyId,opportunityId,'pipeline:write',session);
 if(['ganha','perdida'].includes(row.stage))throw new OpportunityRuleRejected();
 await touch(party,ctx,companyId,session);await Opportunity.updateOne({_id:row._id,tenantId:ctx.tenantId,companyId},{$inc:{proposalRevision:1}},{session});
 return {opportunity:row,party};
}
/** Snapshot catalog data per line; the reference price comes from the server's price tables, never from the browser. */
async function buildItems(ctx:AccessContext,companyId:string,party:{_id:unknown;kind:string;qualificationState?:string},items:{productId:string;quantity:string;unitPriceCents:number;discountCents:number}[],session:mongoose.ClientSession){
 const products=await CatalogProduct.find({tenantId:ctx.tenantId,companyId,_id:{$in:items.map(item=>item.productId)},active:true}).session(session);
 const byId=new Map(products.map(row=>[String(row._id),row]));
 const lines=[];
 for(const item of items){
  const product=byId.get(item.productId);if(!product)throw new ProposalRuleRejected('INVALID_PRODUCT');
  if(!decimalQuantityValid(item.quantity,product.quantityDecimals))throw new ProposalRuleRejected('INVALID_QUANTITY');
  let totalCents:number;try{totalCents=proposalLineCents(item.quantity,item.unitPriceCents,item.discountCents);}catch{throw new ProposalRuleRejected('INVALID_LINE');}
  let referencePriceCents:number|null=null;
  if(party.kind==='customer'&&party.qualificationState==='approved'&&ctx.permissions.includes('catalog:read')){try{referencePriceCents=(await catalogService.resolve(ctx,companyId,{customerId:String(party._id),productId:item.productId})).price?.priceCents??null;}catch{referencePriceCents=null;}}
  lines.push({productId:product._id,code:product.code,description:product.description,kind:product.kind,unit:product.unit,quantity:item.quantity,unitPriceCents:item.unitPriceCents,discountCents:item.discountCents,referencePriceCents,totalCents});
 }
 const totalCents=lines.reduce((sum,line)=>sum+line.totalCents,0);if(totalCents>1e13)throw new ProposalRuleRejected('INVALID_LINE');
 return {items:lines,totalCents};
}
async function load(ctx:AccessContext,companyId:string,opportunityId:string,id:string,session?:mongoose.ClientSession){
 objectId.parse(id);const row=await Proposal.findOne({_id:id,tenantId:ctx.tenantId,companyId,opportunityId}).session(session??null);if(!row)throw new RecordNotFound();return row;
}
const allowed:Record<string,ProposalStatus[]>={update:['rascunho'],send:['rascunho'],revise:['enviada','recusada'],accept:['enviada'],refuse:['enviada'],cancel:['rascunho','enviada']};
export const proposalService={
 async list(ctx:AccessContext,companyId:string,opportunityId:string){
  companyScope(ctx,companyId,'proposal:read');await authorizeOpportunity(ctx,companyId,opportunityId,'pipeline:read');
  const rows=await Proposal.find({tenantId:ctx.tenantId,companyId,opportunityId}).sort({createdAt:-1,_id:-1}).limit(50);
  return {items:rows.map(view)};
 },
 async revisions(ctx:AccessContext,companyId:string,opportunityId:string,id:string):Promise<{items:ProposalRevisionView[]}>{
  companyScope(ctx,companyId,'proposal:read');await authorizeOpportunity(ctx,companyId,opportunityId,'pipeline:read');const row=await load(ctx,companyId,opportunityId,id);
  const rows=await ProposalRevision.find({tenantId:ctx.tenantId,companyId,proposalId:row._id}).sort({revision:-1});
  return {items:rows.map(item=>({revision:item.revision,status:item.revision===row.revision?row.status as ProposalStatus:'enviada',totalCents:item.totalCents,validUntil:item.validUntil,itemCount:item.items.length,sentAt:item.sentAt.toISOString(),createdAt:item.createdAt.toISOString()}))};
 },
 async create(ctx:AccessContext,companyId:string,opportunityId:string,raw:unknown){
  const input=proposalCreateInput.parse(raw);if(input.validUntil<today())throw new ProposalRuleRejected('VALIDITY_IN_PAST');
  return transact(async session=>{
   const {opportunity,party}=await openOpportunity(ctx,companyId,opportunityId,session);
   const built=await buildItems(ctx,companyId,party,input.items,session);
   const sequence=await ProposalSequence.findOneAndUpdate({tenantId:ctx.tenantId,companyId},{$inc:{value:1}},{upsert:true,new:true,session,setDefaultsOnInsert:true});
   const [row]=await Proposal.create([{tenantId:ctx.tenantId,companyId,opportunityId:opportunity._id,number:'PR-'+String(sequence!.value).padStart(6,'0'),validUntil:input.validUntil,notes:input.notes,...built}],{session});
   await history(ctx,companyId,opportunity._id,row!._id,'proposal.created',session,undefined,row!.number+' · '+money(row!.totalCents));
   return view(row!);
  });
 },
 async update(ctx:AccessContext,companyId:string,opportunityId:string,id:string,raw:unknown){
  const input=proposalUpdateInput.parse(raw);if(input.validUntil&&input.validUntil<today())throw new ProposalRuleRejected('VALIDITY_IN_PAST');
  return transact(async session=>{
   const {opportunity,party}=await openOpportunity(ctx,companyId,opportunityId,session);const row=await load(ctx,companyId,opportunityId,id,session);
   if(row.version!==input.version)throw new RecordConflict();if(!allowed.update!.includes(row.status as ProposalStatus))throw new ProposalRuleRejected('STATUS');
   const changes:Record<string,unknown>={...(input.validUntil?{validUntil:input.validUntil}:{}),...(input.notes!==undefined&&Object.hasOwn(raw as object,'notes')?{notes:input.notes}:{}),...(input.items?await buildItems(ctx,companyId,party,input.items,session):{})};
   const updated=await Proposal.findOneAndUpdate({_id:row._id,tenantId:ctx.tenantId,companyId,version:input.version,status:'rascunho'},{$set:changes,$inc:{version:1}},{new:true,session,runValidators:true});if(!updated)throw new RecordConflict();
   await history(ctx,companyId,opportunity._id,row._id,'proposal.updated',session,undefined,updated.number+' rev. '+updated.revision+' · '+money(updated.totalCents));
   return view(updated);
  });
 },
 /** Status changes. Instants come from the server; a sent revision is frozen and can only be superseded by a new revision. */
 async act(ctx:AccessContext,companyId:string,opportunityId:string,id:string,action:'send'|'revise'|'accept'|'refuse'|'cancel',raw:unknown){
  const input=proposalActionInput.parse(raw);
  if(action==='refuse'&&!input.reason)throw new ProposalRuleRejected('REASON_REQUIRED');
  return transact(async session=>{
   const {opportunity}=await openOpportunity(ctx,companyId,opportunityId,session);const row=await load(ctx,companyId,opportunityId,id,session);
   if(row.version!==input.version)throw new RecordConflict();if(!allowed[action]!.includes(row.status as ProposalStatus))throw new ProposalRuleRejected('STATUS');
   const now=new Date();let set:Record<string,unknown>;
   if(action==='send'){
    if(row.validUntil<today())throw new ProposalRuleRejected('VALIDITY_IN_PAST');if(!row.items.length)throw new ProposalRuleRejected('INVALID_LINE');
    await ProposalRevision.create([{tenantId:ctx.tenantId,companyId,proposalId:row._id,revision:row.revision,items:row.toObject().items,totalCents:row.totalCents,validUntil:row.validUntil,notes:row.notes,sentAt:now,sentBy:ctx.userId}],{session});
    set={status:'enviada',sentAt:now,decidedAt:null,decisionReason:''};
   }else if(action==='revise')set={status:'rascunho',revision:row.revision+1,sentAt:null,decidedAt:null,decisionReason:''};
   else if(action==='accept'){
    if(row.validUntil<today())throw new ProposalRuleRejected('EXPIRED');
    if(await Proposal.exists({tenantId:ctx.tenantId,companyId,opportunityId:opportunity._id,status:'aceita',_id:{$ne:row._id}}).session(session))throw new ProposalRuleRejected('ALREADY_ACCEPTED');
    set={status:'aceita',decidedAt:now,decisionReason:input.reason};
   }else set={status:action==='refuse'?'recusada':'cancelada',decidedAt:now,decisionReason:input.reason};
   const updated=await Proposal.findOneAndUpdate({_id:row._id,tenantId:ctx.tenantId,companyId,version:input.version},{$set:set,$inc:{version:1}},{new:true,session,runValidators:true});if(!updated)throw new RecordConflict();
   const names={send:'proposal.sent',revise:'proposal.revised',accept:'proposal.accepted',refuse:'proposal.refused',cancel:'proposal.cancelled'} as const;
   await history(ctx,companyId,opportunity._id,row._id,names[action],session,undefined,updated.number+' rev. '+updated.revision+' · '+money(updated.totalCents)+(input.reason?' · '+input.reason:''));
   return view(updated);
  });
 },
};
