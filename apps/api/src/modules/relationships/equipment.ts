import mongoose from 'mongoose';
import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import type {EquipmentView,PartyHistoryEntry} from '../../../../../packages/contracts/src/relationships.js';
import {auditActorLabel,auditActorNames} from '../../infrastructure/audit-actors.js';
import {Equipment,PartyListOption,Property,RelationshipAudit} from './models.js';
import {equipmentCreateInput,equipmentListInput,equipmentUpdateInput,objectId,serialKey,versionInput} from './input.js';
import {audit,InvalidReference,RecordConflict,RecordNotFound} from './service.js';
import {authorizedParty} from './properties.js';
import {InvalidListOption} from './lists.js';
export class SerialAlreadyRegistered extends Error {}
const literal=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
async function transact<T>(fn:(session:mongoose.ClientSession)=>Promise<T>){
 try{return await mongoose.connection.transaction(fn);}
 catch(error){const mongo=error as {code?:number;keyPattern?:Record<string,unknown>};if(mongo.code===11000)throw mongo.keyPattern?.serialKey?new SerialAlreadyRegistered():new RecordConflict();throw error;}
}
async function views(ctx:AccessContext,companyId:string,rows:InstanceType<typeof Equipment>[]):Promise<EquipmentView[]>{
 const properties=await Property.find({tenantId:ctx.tenantId,companyId,_id:{$in:rows.map(row=>row.propertyId)}}).select('name');
 const names=new Map(properties.map(row=>[String(row._id),row.name]));
 return rows.map(row=>({id:String(row._id),partyId:String(row.partyId),propertyId:String(row.propertyId),propertyName:names.get(String(row.propertyId))??'Propriedade indisponível',categoryId:row.categoryId?String(row.categoryId):null,brand:row.brand,model:row.model,serialNumber:row.serialNumber,status:row.status as EquipmentView['status'],installedAt:row.installedAt??null,warrantyUntil:row.warrantyUntil??null,supplier:row.supplier,notes:row.notes,version:row.version,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()}));
}
/** Property must be an active property of the same live customer; category an active option, unless unchanged. */
async function assertReferences(ctx:AccessContext,companyId:string,partyId:unknown,input:{propertyId?:string;categoryId?:string|null},current:{propertyId?:unknown;categoryId?:unknown}|null,session:mongoose.ClientSession){
 if(input.propertyId&&String(current?.propertyId??'')!==input.propertyId&&!await Property.exists({_id:input.propertyId,tenantId:ctx.tenantId,companyId,partyId,archived:false}).session(session))throw new InvalidReference();
 if(input.categoryId&&String(current?.categoryId??'')!==input.categoryId&&!await PartyListOption.exists({_id:input.categoryId,tenantId:ctx.tenantId,companyId,kind:'equipmentCategory',active:true}).session(session))throw new InvalidListOption();
}
/** Serial check inside the company. Answers only availability, never which customer holds it. */
async function assertSerialAvailable(ctx:AccessContext,companyId:string,key:string,id:unknown,session:mongoose.ClientSession){
 if(key&&await Equipment.exists({tenantId:ctx.tenantId,companyId,serialKey:key,archived:false,...(id?{_id:{$ne:id}}:{})}).session(session))throw new SerialAlreadyRegistered();
}
const tracked=['propertyId','categoryId','brand','model','serialNumber','status','installedAt','warrantyUntil','supplier'] as const;
function changes(before:Record<string,unknown>,after:Record<string,unknown>){
 const text=(value:unknown)=>value===null||value===undefined?'':String(value).slice(0,300);
 return tracked.filter(field=>text(before[field])!==text(after[field])).map(field=>({field:'equipment.'+field,before:text(before[field]),after:text(after[field])}));
}
export const equipmentService={
 async list(ctx:AccessContext,companyId:string,partyId:string,raw:unknown){
  const record=await authorizedParty(ctx,companyId,partyId,false),input=equipmentListInput.parse(raw);
  const search=input.search?{$or:['brand','model','serialNumber'].map(field=>({[field]:{$regex:literal(input.search),$options:'i'}}))}:{};
  const filter={tenantId:ctx.tenantId,companyId,partyId:record._id,archived:false,...(input.propertyId?{propertyId:input.propertyId}:{}),...search};
  const [rows,total]=await Promise.all([Equipment.find(filter).sort({propertyId:1,brand:1,model:1,_id:1}).skip((input.page-1)*20).limit(20),Equipment.countDocuments(filter)]);
  return {items:await views(ctx,companyId,rows),total,page:input.page,pageSize:20};
 },
 async create(ctx:AccessContext,companyId:string,partyId:string,raw:unknown){
  const input=equipmentCreateInput.parse(raw),key=serialKey(input.serialNumber);
  return transact(async session=>{
   const record=await authorizedParty(ctx,companyId,partyId,true,session);
   await assertReferences(ctx,companyId,record._id,input,null,session);await assertSerialAvailable(ctx,companyId,key,null,session);
   const [row]=await Equipment.create([{...input,serialKey:key,tenantId:ctx.tenantId,companyId,partyId:record._id}],{session});
   await audit(ctx,companyId,row!._id,'equipment.created',session,undefined,changes({},row!.toObject()));
   return (await views(ctx,companyId,[row!]))[0]!;
  });
 },
 async update(ctx:AccessContext,companyId:string,partyId:string,id:string,raw:unknown){
  objectId.parse(id);const parsed=equipmentUpdateInput.parse(raw),{version}=parsed;
  const input:Record<string,unknown>=Object.fromEntries(Object.entries(parsed).filter(([key])=>key!=='version'&&Object.hasOwn(raw as object,key)));
  return transact(async session=>{
   const record=await authorizedParty(ctx,companyId,partyId,true,session);
   const old=await Equipment.findOne({_id:id,tenantId:ctx.tenantId,companyId,partyId:record._id,archived:false}).session(session);if(!old)throw new RecordNotFound();
   const installedAt=Object.hasOwn(input,'installedAt')?input.installedAt:old.installedAt,warrantyUntil=Object.hasOwn(input,'warrantyUntil')?input.warrantyUntil:old.warrantyUntil;
   if(installedAt&&warrantyUntil&&String(warrantyUntil)<String(installedAt))throw new InvalidReference();
   await assertReferences(ctx,companyId,record._id,input as {propertyId?:string;categoryId?:string|null},old,session);
   if(typeof input.serialNumber==='string'){input.serialKey=serialKey(input.serialNumber);if(input.serialKey!==old.serialKey)await assertSerialAvailable(ctx,companyId,String(input.serialKey),old._id,session);}
   const row=await Equipment.findOneAndUpdate({_id:id,tenantId:ctx.tenantId,companyId,partyId:record._id,archived:false,version},{$set:input,$inc:{version:1}},{new:true,session,runValidators:true});
   if(!row)throw new RecordConflict();
   await audit(ctx,companyId,row._id,'equipment.updated',session,undefined,changes(old.toObject(),row.toObject()));
   return (await views(ctx,companyId,[row]))[0]!;
  });
 },
 async archive(ctx:AccessContext,companyId:string,partyId:string,id:string,raw:unknown){
  objectId.parse(id);const {version}=versionInput.parse(raw);
  return transact(async session=>{
   const record=await authorizedParty(ctx,companyId,partyId,true,session);
   const row=await Equipment.findOneAndUpdate({_id:id,tenantId:ctx.tenantId,companyId,partyId:record._id,archived:false,version},{$set:{archived:true},$inc:{version:1}},{new:true,session});
   if(!row){if(await Equipment.exists({_id:id,tenantId:ctx.tenantId,companyId,partyId:record._id,archived:false}).session(session))throw new RecordConflict();throw new RecordNotFound();}
   await audit(ctx,companyId,row._id,'equipment.archived',session);return {id};
  });
 },
 /** Equipment timeline. Visits, tickets, work orders and parts join this view in their own stages. */
 async timeline(ctx:AccessContext,companyId:string,partyId:string,id:string):Promise<{items:PartyHistoryEntry[]}>{
  objectId.parse(id);const record=await authorizedParty(ctx,companyId,partyId,false);
  const row=await Equipment.findOne({_id:id,tenantId:ctx.tenantId,companyId,partyId:record._id});if(!row)throw new RecordNotFound();
  const events=await RelationshipAudit.find({tenantId:ctx.tenantId,companyId,entityId:row._id}).sort({createdAt:-1,_id:-1}).limit(100);
  const values=events.flatMap(event=>(event.changes??[]).flatMap(change=>[change.before,change.after].filter(value=>/^[a-f0-9]{24}$/i.test(value))));
  const [names,properties,options]=await Promise.all([auditActorNames(ctx.tenantId,events.map(event=>String(event.actorId))),Property.find({tenantId:ctx.tenantId,companyId,_id:{$in:values}}).select('name'),PartyListOption.find({tenantId:ctx.tenantId,companyId,_id:{$in:values}}).select('label')]);
  const labels=new Map([...properties.map(item=>[String(item._id),item.name] as const),...options.map(item=>[String(item._id),item.label] as const)]);
  return {items:events.map(event=>({action:event.action,actor:auditActorLabel(names,String(event.actorId),ctx.userId),at:event.createdAt.toISOString(),reason:'',changes:(event.changes??[]).map(change=>({field:change.field,before:labels.get(change.before)??change.before,after:labels.get(change.after)??change.after}))}))};
 },
};
