import mongoose from 'mongoose';
import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import {decimalQuantityValid} from '../../../../../packages/contracts/src/catalog.js';
import {proposalLineCents} from '../../../../../packages/contracts/src/opportunities.js';
import {milliToQuantity,quantityToMilli} from '../../../../../packages/contracts/src/technical.js';
import type {CompanyProfileView,PurchaseAction,PurchaseEventView,PurchaseView,SupplierView} from '../../../../../packages/contracts/src/supply.js';
import {companyScope} from '../../infrastructure/access.js';
import {auditActorLabel,auditActorNames} from '../../infrastructure/audit-actors.js';
import {CatalogProduct} from '../catalog/models.js';
import {objectId} from '../relationships/input.js';
import {RecordConflict,RecordNotFound} from '../relationships/service.js';
import {CompanyProfile,PurchaseEvent,PurchaseOrder,PurchaseSequence,Supplier,SupplyAudit} from './models.js';
import {companyProfileInput,purchaseActionInput,purchaseInput,purchaseListInput,purchaseReceiveInput,purchaseUpdateInput,supplierInput,supplierListInput,supplierUpdateInput,SupplyRuleRejected} from './input.js';
import {moveStock,transact} from './stock.js';
const literal=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const emptyAddress={street:'',number:'',complement:'',district:'',city:'',state:'',zip:''};
const nameKey=(value:string)=>value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('pt-BR').trim();
type ProfileRow=InstanceType<typeof CompanyProfile>;
function profileView(row:ProfileRow|null):CompanyProfileView{
 const address={...emptyAddress,...(row?.address?{street:row.address.street,number:row.address.number,complement:row.address.complement,district:row.address.district,city:row.address.city,state:row.address.state,zip:row.address.zip}:{})} as CompanyProfileView['address'];
 return {legalName:row?.legalName??'',tradeName:row?.tradeName??'',taxId:row?.taxId??'',stateRegistration:row?.stateRegistration??'',municipalRegistration:row?.municipalRegistration??'',address,phone:row?.phone??'',email:row?.email??'',website:row?.website??'',logo:row?.logo??null,documentNotes:row?.documentNotes??'',purchaseApprovalLimitCents:row?.purchaseApprovalLimitCents??0,version:row?.version??0,updatedAt:row?.updatedAt?.toISOString()??null};
}
/** Company data shown on documents: any member of the company reads it; only company:manage edits it. */
export const companyProfileService={
 async get(ctx:AccessContext,companyId:string){const scope=companyScope(ctx,companyId,'company:read');return {record:profileView(await CompanyProfile.findOne(scope))};},
 async save(ctx:AccessContext,companyId:string,raw:unknown){
  const input=companyProfileInput.parse(raw),scope=companyScope(ctx,companyId,'company:manage');
  return transact(async session=>{
   const {version,...fields}=input,current=await CompanyProfile.findOne(scope).session(session);if((current?.version??0)!==version)throw new RecordConflict();
   const row=current?await CompanyProfile.findOneAndUpdate({_id:current._id,version},{$set:fields,$inc:{version:1}},{new:true,session,runValidators:true}):(await CompanyProfile.create([{...scope,...fields,version:1}],{session}))[0];if(!row)throw new RecordConflict();
   await SupplyAudit.create([{...scope,actorId:ctx.userId,action:'company_profile.updated',entityId:row._id,note:''}],{session});
   return {record:profileView(row)};
  });
 },
};
function supplierView(row:InstanceType<typeof Supplier>):SupplierView{return {id:String(row._id),name:row.name,tradeName:row.tradeName,taxId:row.taxId,stateRegistration:row.stateRegistration,contactName:row.contactName,phone:row.phone,email:row.email,address:{...emptyAddress,...(row.address?{street:row.address.street,number:row.address.number,complement:row.address.complement,district:row.address.district,city:row.address.city,state:row.address.state,zip:row.address.zip}:{})} as SupplierView['address'],paymentTerms:row.paymentTerms,notes:row.notes,active:row.active,version:row.version};}
export const supplierService={
 async list(ctx:AccessContext,companyId:string,raw:unknown){
  const input=supplierListInput.parse(raw),scope=companyScope(ctx,companyId,'supplier:read');
  const filter={...scope,...(input.active==='all'?{}:{active:input.active==='true'}),...(input.search?{$or:[{nameKey:{$regex:literal(nameKey(input.search))}},{tradeName:{$regex:literal(input.search),$options:'i'}},{taxId:{$regex:literal(input.search.replace(/\D/g,'')||'^$')}}]}:{})};
  const [rows,total]=await Promise.all([Supplier.find(filter).sort({nameKey:1,_id:1}).skip((input.page-1)*20).limit(20),Supplier.countDocuments(filter)]);
  return {items:rows.map(supplierView),total,page:input.page,pageSize:20};
 },
 async create(ctx:AccessContext,companyId:string,raw:unknown){
  const input=supplierInput.parse(raw),scope=companyScope(ctx,companyId,'supplier:write');
  return transact(async session=>{const [row]=await Supplier.create([{...scope,...input,nameKey:nameKey(input.name)}],{session});await SupplyAudit.create([{...scope,actorId:ctx.userId,action:'supplier.created',entityId:row!._id,note:input.name}],{session});return {record:supplierView(row!)};});
 },
 async update(ctx:AccessContext,companyId:string,id:string,raw:unknown){
  objectId.parse(id);const input=supplierUpdateInput.parse(raw),scope=companyScope(ctx,companyId,'supplier:write'),{version,...fields}=input;
  return transact(async session=>{
   const row=await Supplier.findOneAndUpdate({...scope,_id:id,version},{$set:{...fields,...(fields.name?{nameKey:nameKey(fields.name)}:{})},$inc:{version:1}},{new:true,session,runValidators:true});
   if(!row){if(await Supplier.exists({...scope,_id:id}).session(session))throw new RecordConflict();throw new RecordNotFound();}
   await SupplyAudit.create([{...scope,actorId:ctx.userId,action:'supplier.updated',entityId:row._id,note:''}],{session});return {record:supplierView(row)};
  });
 },
};
type Line={productId:string;quantity:string;unitCostCents:number};
async function buildItems(ctx:AccessContext,companyId:string,lines:Line[],session:mongoose.ClientSession){
 if(new Set(lines.map(line=>line.productId)).size!==lines.length)throw new SupplyRuleRejected('DUPLICATE_ITEM');
 const products=new Map((await CatalogProduct.find({tenantId:ctx.tenantId,companyId,_id:{$in:lines.map(line=>line.productId)},active:true}).session(session)).map(row=>[String(row._id),row]));
 const items=lines.map(line=>{const product=products.get(line.productId);if(!product)throw new SupplyRuleRejected('INVALID_PRODUCT');if(!decimalQuantityValid(line.quantity,product.quantityDecimals))throw new SupplyRuleRejected('INVALID_QUANTITY');
  return {productId:product._id,code:product.code,description:product.description,kind:product.kind,unit:product.unit,quantityDecimals:product.quantityDecimals,quantity:line.quantity,unitCostCents:line.unitCostCents,totalCents:proposalLineCents(line.quantity,line.unitCostCents,0),receivedMilli:0};});
 return {items,totalCents:items.reduce((sum,item)=>sum+item.totalCents,0)};
}
async function activeSupplier(ctx:AccessContext,companyId:string,id:unknown,session:mongoose.ClientSession){const row=await Supplier.findOne({tenantId:ctx.tenantId,companyId,_id:id,active:true}).session(session);if(!row)throw new SupplyRuleRejected('INVALID_SUPPLIER');return row;}
async function event(ctx:AccessContext,companyId:string,purchaseId:unknown,action:string,session:mongoose.ClientSession,note=''){await PurchaseEvent.create([{tenantId:ctx.tenantId,companyId,purchaseId,actorId:ctx.userId,action,note}],{session});}
async function purchaseView(ctx:AccessContext,row:InstanceType<typeof PurchaseOrder>,supplierName:string):Promise<PurchaseView>{
 const names=await auditActorNames(ctx.tenantId,[String(row.createdBy),...(row.approvedBy?[String(row.approvedBy)]:[])]),write=ctx.permissions.includes('purchase:write');
 const items=row.items.map(item=>{const decimals=Math.max(item.quantityDecimals,0),total=quantityToMilli(item.quantity);return {productId:String(item.productId),code:item.code,description:item.description,kind:item.kind as 'product',unit:item.unit,quantityDecimals:item.quantityDecimals,quantity:item.quantity,received:milliToQuantity(item.receivedMilli,decimals),pending:milliToQuantity(Math.max(0,total-item.receivedMilli),decimals),unitCostCents:item.unitCostCents,totalCents:item.totalCents};});
 const received=row.items.some(item=>item.receivedMilli>0);
 return {id:String(row._id),number:row.number,supplierId:String(row.supplierId),supplierName,status:row.status as PurchaseView['status'],items,totalCents:row.totalCents,expectedDate:row.expectedDate,paymentTerms:row.paymentTerms,notes:row.notes,decisionNote:row.decisionNote,needsApproval:row.needsApproval,
  submittedAt:row.submittedAt?.toISOString()??null,approvedAt:row.approvedAt?.toISOString()??null,approvedBy:row.approvedBy?names.get(String(row.approvedBy))??'':'',sentAt:row.sentAt?.toISOString()??null,receivedAt:row.receivedAt?.toISOString()??null,cancelledAt:row.cancelledAt?.toISOString()??null,createdBy:names.get(String(row.createdBy))??'',
  canEdit:row.status==='rascunho'&&write,canSubmit:row.status==='rascunho'&&write,canApprove:row.status==='aguardando_aprovacao'&&ctx.permissions.includes('purchase:approve')&&String(row.submittedBy)!==ctx.userId,canSend:row.status==='aprovado'&&write,
  canReceive:['aprovado','enviado','recebido_parcial'].includes(row.status)&&(write||ctx.permissions.includes('stock:write')),canCancel:['rascunho','aguardando_aprovacao','aprovado','enviado'].includes(row.status)&&!received&&(write||ctx.permissions.includes('purchase:approve')),version:row.version,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()};
}
async function loadPurchase(ctx:AccessContext,companyId:string,id:string,session?:mongoose.ClientSession){
 objectId.parse(id);const row=await PurchaseOrder.findOne({_id:id,tenantId:ctx.tenantId,companyId}).session(session??null);if(!row)throw new RecordNotFound();
 const supplier=await Supplier.findOne({_id:row.supplierId,tenantId:ctx.tenantId,companyId}).session(session??null);return {row,supplier};
}
/** Purchase orders: totals on the server, approval only above the company limit (by someone other than the submitter), receipt into the warehouse. */
export const purchaseService={
 async list(ctx:AccessContext,companyId:string,raw:unknown){
  const input=purchaseListInput.parse(raw),scope=companyScope(ctx,companyId,'purchase:read');
  const filter={...scope,...(input.status==='all'?{}:input.status==='open'?{status:{$in:['rascunho','aguardando_aprovacao','aprovado','enviado','recebido_parcial']}}:{status:input.status}),...(input.supplierId?{supplierId:input.supplierId}:{}),...(input.search?{number:{$regex:literal(input.search),$options:'i'}}:{})};
  const [rows,total]=await Promise.all([PurchaseOrder.find(filter).sort({createdAt:-1,_id:-1}).skip((input.page-1)*20).limit(20),PurchaseOrder.countDocuments(filter)]);
  const suppliers=new Map((await Supplier.find({...scope,_id:{$in:rows.map(row=>row.supplierId)}}).select('name')).map(row=>[String(row._id),row.name]));
  const items=[];for(const row of rows)items.push(await purchaseView(ctx,row,suppliers.get(String(row.supplierId))??''));
  return {items,total,page:input.page,pageSize:20};
 },
 async detail(ctx:AccessContext,companyId:string,id:string){
  companyScope(ctx,companyId,'purchase:read');const {row,supplier}=await loadPurchase(ctx,companyId,id);
  const events=await PurchaseEvent.find({tenantId:ctx.tenantId,companyId,purchaseId:row._id}).sort({createdAt:1,_id:1}).limit(200),names=await auditActorNames(ctx.tenantId,events.map(item=>String(item.actorId)));
  const history:PurchaseEventView[]=events.map(item=>({action:item.action,actor:auditActorLabel(names,String(item.actorId),ctx.userId),at:item.createdAt.toISOString(),note:item.note}));
  return {record:await purchaseView(ctx,row,supplier?.name??''),supplier:supplier?supplierView(supplier):null,history};
 },
 async create(ctx:AccessContext,companyId:string,raw:unknown){
  const input=purchaseInput.parse(raw),scope=companyScope(ctx,companyId,'purchase:write');
  return transact(async session=>{
   await activeSupplier(ctx,companyId,input.supplierId,session);const built=await buildItems(ctx,companyId,input.items,session);
   const sequence=await PurchaseSequence.findOneAndUpdate(scope,{$inc:{value:1}},{upsert:true,new:true,session,setDefaultsOnInsert:true});
   const [row]=await PurchaseOrder.create([{...scope,number:'PC-'+String(sequence!.value).padStart(6,'0'),supplierId:input.supplierId,items:built.items,totalCents:built.totalCents,expectedDate:input.expectedDate,paymentTerms:input.paymentTerms,notes:input.notes,createdBy:ctx.userId}],{session});
   await event(ctx,companyId,row!._id,'created',session);return {id:String(row!._id),number:row!.number};
  });
 },
 async update(ctx:AccessContext,companyId:string,id:string,raw:unknown){
  const input=purchaseUpdateInput.parse(raw);companyScope(ctx,companyId,'purchase:write');
  return transact(async session=>{
   const {row}=await loadPurchase(ctx,companyId,id,session);if(row.version!==input.version)throw new RecordConflict();if(row.status!=='rascunho')throw new SupplyRuleRejected('STATUS');
   const set:Record<string,unknown>={};for(const key of ['expectedDate','paymentTerms','notes'] as const)if(input[key]!==undefined)set[key]=input[key];
   if(input.supplierId){await activeSupplier(ctx,companyId,input.supplierId,session);set.supplierId=input.supplierId;}
   if(input.items){const built=await buildItems(ctx,companyId,input.items,session);Object.assign(set,{items:built.items,totalCents:built.totalCents});}
   const updated=await PurchaseOrder.findOneAndUpdate({_id:row._id,version:input.version,status:'rascunho'},{$set:set,$inc:{version:1}},{new:true,session,runValidators:true});if(!updated)throw new RecordConflict();
   await event(ctx,companyId,row._id,'updated',session);const supplier=await Supplier.findById(updated.supplierId).session(session);return purchaseView(ctx,updated,supplier?.name??'');
  });
 },
 async act(ctx:AccessContext,companyId:string,id:string,action:PurchaseAction,raw:unknown){
  const input=purchaseActionInput.parse(raw);companyScope(ctx,companyId,'purchase:read');
  if((action==='reject'||action==='cancel')&&input.note.length<5)throw new SupplyRuleRejected('REASON_REQUIRED');
  return transact(async session=>{
   const {row,supplier}=await loadPurchase(ctx,companyId,id,session);if(row.version!==input.version)throw new RecordConflict();
   const current=await purchaseView(ctx,row,supplier?.name??''),now=new Date();
   if(action==='submit'){
    if(!current.canSubmit)throw new SupplyRuleRejected('STATUS');await activeSupplier(ctx,companyId,row.supplierId,session);
    const profile=await CompanyProfile.findOne({tenantId:ctx.tenantId,companyId}).session(session),limit=profile?.purchaseApprovalLimitCents??0;
    row.needsApproval=row.totalCents>limit;row.submittedBy=new mongoose.Types.ObjectId(ctx.userId);row.submittedAt=now;row.status=row.needsApproval?'aguardando_aprovacao':'aprovado';if(!row.needsApproval)row.approvedAt=now;
   }else if(action==='approve'||action==='reject'){
    if(!current.canApprove)throw new SupplyRuleRejected(row.status==='aguardando_aprovacao'?'SELF_APPROVAL':'STATUS');
    if(action==='approve'){row.status='aprovado';row.approvedBy=new mongoose.Types.ObjectId(ctx.userId);row.approvedAt=now;}else{row.status='rascunho';row.submittedAt=null;}row.decisionNote=input.note;
   }else if(action==='send'){if(!current.canSend)throw new SupplyRuleRejected('STATUS');row.status='enviado';row.sentAt=now;}
   else{if(!current.canCancel)throw new SupplyRuleRejected('STATUS');row.status='cancelado';row.cancelledAt=now;row.decisionNote=input.note;}
   row.version++;await row.save({session});await event(ctx,companyId,row._id,action,session,action==='submit'?(row.needsApproval?'Acima do limite de aprovação':'Dentro do limite: aprovado automaticamente'):input.note);
   return purchaseView(ctx,row,supplier?.name??'');
  });
 },
 /** Receipt (total or partial): products enter the warehouse at the purchase unit cost, updating the weighted average cost. */
 async receive(ctx:AccessContext,companyId:string,id:string,raw:unknown){
  const input=purchaseReceiveInput.parse(raw);companyScope(ctx,companyId,'purchase:read');
  return transact(async session=>{
   const {row,supplier}=await loadPurchase(ctx,companyId,id,session);if(row.version!==input.version)throw new RecordConflict();
   if(!(await purchaseView(ctx,row,supplier?.name??'')).canReceive)throw new SupplyRuleRejected('STATUS');
   const summary:string[]=[];
   for(const line of input.lines){
    const item=row.items.find(entry=>String(entry.productId)===line.productId);if(!item)throw new SupplyRuleRejected('INVALID_PRODUCT');
    if(!decimalQuantityValid(line.quantity,item.quantityDecimals))throw new SupplyRuleRejected('INVALID_QUANTITY');
    const milli=quantityToMilli(line.quantity),pending=quantityToMilli(item.quantity)-item.receivedMilli;if(milli>pending)throw new SupplyRuleRejected('ABOVE_PENDING');
    await moveStock(ctx,companyId,{productId:item.productId,direction:'entrada',quantityMilli:milli,source:'compra',sourceKey:'compra:'+String(row._id)+':'+String(item.productId)+':'+item.receivedMilli,reference:row.number,referenceId:row._id,note:input.note,unitCostCents:item.unitCostCents,allowNegative:true,updateAverageCost:true},session);
    item.receivedMilli+=milli;summary.push(line.quantity+' '+item.unit+' '+item.code);
   }
   const complete=row.items.every(item=>item.receivedMilli>=quantityToMilli(item.quantity));row.status=complete?'recebido':'recebido_parcial';if(complete)row.receivedAt=new Date();
   row.version++;await row.save({session});await event(ctx,companyId,row._id,'received',session,summary.join('; ')+(input.note?' — '+input.note:''));
   return purchaseView(ctx,row,supplier?.name??'');
  });
 },
};
