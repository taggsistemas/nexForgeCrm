import mongoose from 'mongoose';
import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import {milliToQuantity,quantityToMilli} from '../../../../../packages/contracts/src/technical.js';
import {decimalQuantityValid} from '../../../../../packages/contracts/src/catalog.js';
import {averageCost,stockManualReasonNames,type StockBalanceView,type StockMovementView,type StockSource} from '../../../../../packages/contracts/src/supply.js';
import {companyScope} from '../../infrastructure/access.js';
import {auditActorLabel,auditActorNames} from '../../infrastructure/audit-actors.js';
import {CatalogAudit,CatalogProduct} from '../catalog/models.js';
import {RecordConflict} from '../relationships/service.js';
import {StockBalance,StockMovement,SupplyAudit} from './models.js';
import {manualMovementInput,movementListInput,stockListInput,SupplyRuleRejected} from './input.js';
const oid=(id:string)=>new mongoose.Types.ObjectId(id);
const literal=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export async function transact<T>(fn:(session:mongoose.ClientSession)=>Promise<T>){try{return await mongoose.connection.transaction(fn);}catch(error){if((error as {code?:number}).code===11000)throw new RecordConflict();throw error;}}
export interface StockMove {productId:unknown;direction:'entrada'|'saida';quantityMilli:number;source:StockSource;sourceKey?:string;reason?:string;reference?:string;referenceId?:unknown;note?:string;unitCostCents?:number|null;allowNegative:boolean;updateAverageCost?:boolean}
/**
 * The single warehouse write path, always inside the caller's transaction. Services are not stocked (returns null).
 * Automatic movements carry a source key: a retry returns the existing movement instead of moving stock twice.
 * Manual exits never go negative; automatic exits (delivery, work-order parts) may, with an alert on the movement.
 */
export async function moveStock(ctx:AccessContext,companyId:string,move:StockMove,session:mongoose.ClientSession){
 const ids={tenantId:ctx.tenantId,companyId};
 const product=await CatalogProduct.findOne({...ids,_id:move.productId}).select('kind costCents').session(session);if(!product||product.kind!=='product')return null;
 if(move.sourceKey){const existing=await StockMovement.findOne({...ids,sourceKey:move.sourceKey}).session(session);if(existing)return existing;}
 const delta=move.direction==='entrada'?move.quantityMilli:-move.quantityMilli;
 if(move.updateAverageCost&&move.direction==='entrada'&&move.unitCostCents!==null&&move.unitCostCents!==undefined){
  const before=await StockBalance.findOne({...ids,productId:product._id}).session(session),cost=averageCost(before?.quantityMilli??0,product.costCents??null,move.quantityMilli,move.unitCostCents);
  // Purchase receipts keep the catalog cost as a weighted average, versioned and audited like a manual cost change.
  if(cost!==product.costCents){const updated=await CatalogProduct.findOneAndUpdate({_id:product._id,...ids},{$set:{costCents:cost},$inc:{costVersion:1}},{new:true,session});await CatalogAudit.create([{...ids,actorId:ctx.userId,entityId:product._id,action:'product.cost_updated',version:updated!.costVersion}],{session});}
 }
 const balance=await StockBalance.findOneAndUpdate({...ids,productId:product._id},{$inc:{quantityMilli:delta,version:1}},{upsert:true,new:true,session,setDefaultsOnInsert:true});
 const after=balance!.quantityMilli;if(after<0&&!move.allowNegative)throw new SupplyRuleRejected('INSUFFICIENT_STOCK');
 const [row]=await StockMovement.create([{...ids,productId:product._id,direction:move.direction,source:move.source,sourceKey:move.sourceKey??null,reason:move.reason??'',quantityMilli:move.quantityMilli,balanceAfterMilli:after,unitCostCents:move.unitCostCents??null,negativeAlert:after<0,reference:move.reference??'',referenceId:move.referenceId??null,note:move.note??'',actorId:ctx.userId}],{session});
 return row!;
}
export const stockService={
 /** Balances of stocked catalog products; value and cost only with cost:read. */
 async balances(ctx:AccessContext,companyId:string,raw:unknown){
  const input=stockListInput.parse(raw),scope=companyScope(ctx,companyId,'stock:read'),costs=ctx.permissions.includes('cost:read');
  const match={tenantId:oid(scope.tenantId),companyId:oid(companyId),kind:'product',...(input.search?{$or:[{code:{$regex:literal(input.search),$options:'i'}},{description:{$regex:literal(input.search),$options:'i'}}]}:{})};
  const after=input.filter==='negative'?[{$match:{quantityMilli:{$lt:0}}}]:input.filter==='stocked'?[{$match:{quantityMilli:{$ne:0}}}]:[{$match:{$or:[{active:true},{quantityMilli:{$ne:0}}]}}];
  const [result]=await CatalogProduct.aggregate([{$match:match},{$lookup:{from:StockBalance.collection.name,localField:'_id',foreignField:'productId',pipeline:[{$match:{tenantId:oid(scope.tenantId),companyId:oid(companyId)}}],as:'balance'}},
   {$addFields:{quantityMilli:{$ifNull:[{$arrayElemAt:['$balance.quantityMilli',0]},0]},balanceUpdatedAt:{$arrayElemAt:['$balance.updatedAt',0]}}},...after,{$sort:{description:1,_id:1}},
   {$facet:{total:[{$count:'count'}],negative:[{$match:{quantityMilli:{$lt:0}}},{$count:'count'}],items:[{$skip:(input.page-1)*30},{$limit:30}]}}]);
  const items:StockBalanceView[]=result.items.map((row:{_id:unknown;code:string;description:string;unit:string;quantityDecimals:number;quantityMilli:number;costCents?:number|null;balanceUpdatedAt?:Date})=>({productId:String(row._id),code:row.code,description:row.description,unit:row.unit,quantityDecimals:row.quantityDecimals,quantity:milliToQuantity(row.quantityMilli,Math.max(row.quantityDecimals,0)),quantityMilli:row.quantityMilli,negative:row.quantityMilli<0,updatedAt:row.balanceUpdatedAt?row.balanceUpdatedAt.toISOString():null,
   ...(costs?{costCents:row.costCents??null,valueCents:row.costCents===null||row.costCents===undefined?null:Math.round(row.quantityMilli*row.costCents/1000)}:{})}));
  const [negatives]=await StockBalance.aggregate([{$match:{tenantId:oid(scope.tenantId),companyId:oid(companyId),quantityMilli:{$lt:0}}},{$count:'count'}]);
  return {items,total:result.total[0]?.count??0,negativeCount:negatives?.count??0,page:input.page,pageSize:30};
 },
 async movements(ctx:AccessContext,companyId:string,raw:unknown){
  const input=movementListInput.parse(raw),scope=companyScope(ctx,companyId,'stock:read'),costs=ctx.permissions.includes('cost:read');
  const filter={...scope,...(input.productId?{productId:input.productId}:{}),...(input.source?{source:input.source}:{})};
  const [rows,total]=await Promise.all([StockMovement.find(filter).sort({createdAt:-1,_id:-1}).skip((input.page-1)*50).limit(50),StockMovement.countDocuments(filter)]);
  const products=new Map((await CatalogProduct.find({...scope,_id:{$in:rows.map(row=>row.productId)}}).select('code description unit quantityDecimals')).map(row=>[String(row._id),row]));
  const names=await auditActorNames(ctx.tenantId,rows.map(row=>String(row.actorId)));
  const items:StockMovementView[]=rows.map(row=>{const product=products.get(String(row.productId)),decimals=Math.max(product?.quantityDecimals??0,0);return {id:String(row._id),productId:String(row.productId),code:product?.code??'',description:product?.description??'',unit:product?.unit??'',direction:row.direction as 'entrada',source:row.source as StockSource,
   reason:row.reason?stockManualReasonNames[row.reason as keyof typeof stockManualReasonNames]??row.reason:'',quantity:milliToQuantity(row.quantityMilli,decimals),balanceAfter:milliToQuantity(row.balanceAfterMilli,decimals),negativeAlert:row.negativeAlert,reference:row.reference,note:row.note,actor:auditActorLabel(names,String(row.actorId),ctx.userId),createdAt:row.createdAt.toISOString(),...(costs?{unitCostCents:row.unitCostCents??null}:{})};});
  return {items,total,page:input.page,pageSize:50};
 },
 /** Manual entry or exit with a reason; exits never leave the balance negative. */
 async manual(ctx:AccessContext,companyId:string,raw:unknown){
  const input=manualMovementInput.parse(raw),scope=companyScope(ctx,companyId,'stock:write');
  return transact(async session=>{
   const product=await CatalogProduct.findOne({...scope,_id:input.productId,kind:'product'}).session(session);if(!product)throw new SupplyRuleRejected('INVALID_PRODUCT');
   if(!decimalQuantityValid(input.quantity,product.quantityDecimals))throw new SupplyRuleRejected('INVALID_QUANTITY');
   const row=(await moveStock(ctx,companyId,{productId:product._id,direction:input.direction,quantityMilli:quantityToMilli(input.quantity),source:'manual',reason:input.reason,note:input.note,allowNegative:false},session))!;
   await SupplyAudit.create([{...scope,actorId:ctx.userId,action:'stock.manual_'+input.direction,entityId:row._id,note:input.quantity+' '+product.unit+' — '+product.code}],{session});
   return {id:String(row._id),balanceAfter:milliToQuantity(row.balanceAfterMilli,Math.max(product.quantityDecimals,0))};
  });
 },
};
