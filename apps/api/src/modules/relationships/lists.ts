import mongoose from 'mongoose';
import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import {defaultPartyListOptions,partyListKinds,type PartyListKind,type PartyListOptionView} from '../../../../../packages/contracts/src/relationships.js';
import {companyScope} from '../../infrastructure/access.js';
import {PartyListOption,RelationshipAudit} from './models.js';
import {listOptionCreateInput,listOptionUpdateInput,objectId} from './input.js';
export class InvalidListOption extends Error {}
export class ListOptionNotFound extends Error {}
export class ListVersionConflict extends Error {}
const fieldKinds={originId:'origin',segmentId:'segment',classificationId:'classification',potentialId:'potential'} as const satisfies Record<string,PartyListKind>;
export const classificationKeys=Object.keys(fieldKinds) as (keyof typeof fieldKinds)[];
const labelKey=(label:string)=>label.normalize('NFD').replace(/[̀-ͯ]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
function view(row:InstanceType<typeof PartyListOption>):PartyListOptionView{return {id:String(row._id),kind:row.kind as PartyListKind,label:row.label,active:row.active,order:row.order,version:row.version};}
async function transact<T>(fn:(session:mongoose.ClientSession)=>Promise<T>){try{return await mongoose.connection.transaction(fn);}catch(error){if((error as {code?:number}).code===11000)throw new InvalidListOption();throw error;}}
/** Idempotent per company: the unique labelKey index absorbs concurrent first reads. */
async function seedDefaults(tenantId:string,companyId:string){
 if(await PartyListOption.exists({tenantId,companyId}))return;
 const tenant=new mongoose.Types.ObjectId(tenantId),company=new mongoose.Types.ObjectId(companyId);
 const rows=partyListKinds.flatMap(kind=>defaultPartyListOptions[kind].map((label,order)=>({kind,label,labelKey:labelKey(label),order})));
 await PartyListOption.bulkWrite(rows.map(row=>({updateOne:{filter:{tenantId:tenant,companyId:company,kind:row.kind,labelKey:row.labelKey},update:{$setOnInsert:{label:row.label,order:row.order}},upsert:true}})),{ordered:false}).catch(error=>{if((error as {code?:number}).code!==11000)throw error;});
}
/**
 * Validates classification IDs against the live company lists. An inactive option may stay
 * on a record that already uses it, but cannot be newly assigned.
 */
export async function assertListOptions(ctx:AccessContext,companyId:string,values:Record<string,unknown>,current:Record<string,unknown>={},session?:mongoose.ClientSession){
 for(const key of classificationKeys){
  if(!Object.hasOwn(values,key)||values[key]===null||values[key]===undefined)continue;
  const id=String(values[key]);if(current[key]&&String(current[key])===id)continue;
  if(!await PartyListOption.exists({_id:id,tenantId:ctx.tenantId,companyId,kind:fieldKinds[key],active:true}).session(session??null))throw new InvalidListOption();
 }
}
export const partyLists={
 async list(ctx:AccessContext,companyId:string){
  const scope=companyScope(ctx,companyId,'company:read');await seedDefaults(scope.tenantId,companyId);
  const rows=await PartyListOption.find(scope).sort({kind:1,order:1,label:1}).limit(500);
  return {items:rows.map(view)};
 },
 async create(ctx:AccessContext,companyId:string,raw:unknown){
  const input=listOptionCreateInput.parse(raw),scope=companyScope(ctx,companyId,'list:manage');await seedDefaults(scope.tenantId,companyId);
  return transact(async session=>{
   const [row]=await PartyListOption.create([{...scope,...input,labelKey:labelKey(input.label)}],{session});
   await RelationshipAudit.create([{...scope,actorId:ctx.userId,entityId:row!._id,action:'list.created',changes:[{field:input.kind,before:'',after:input.label}]}],{session});
   return view(row!);
  });
 },
 async update(ctx:AccessContext,companyId:string,id:string,raw:unknown){
  objectId.parse(id);const input=listOptionUpdateInput.parse(raw),scope=companyScope(ctx,companyId,'list:manage');
  return transact(async session=>{
   const old=await PartyListOption.findOne({...scope,_id:id}).session(session);if(!old)throw new ListOptionNotFound();
   const fields={...(input.label!==undefined?{label:input.label,labelKey:labelKey(input.label)}:{}),...(input.active!==undefined?{active:input.active}:{}),...(input.order!==undefined?{order:input.order}:{})};
   const row=await PartyListOption.findOneAndUpdate({...scope,_id:id,version:input.version},{$set:fields,$inc:{version:1}},{new:true,session,runValidators:true});
   if(!row)throw new ListVersionConflict();
   const changes=[...(input.label!==undefined&&input.label!==old.label?[{field:'label',before:old.label,after:input.label}]:[]),...(input.active!==undefined&&input.active!==old.active?[{field:'active',before:String(old.active),after:String(input.active)}]:[])];
   await RelationshipAudit.create([{...scope,actorId:ctx.userId,entityId:row._id,action:'list.updated',...(changes.length?{changes}:{})}],{session});
   return view(row);
  });
 },
 /** Labels for history/views; IDs from other companies resolve to nothing. */
 async labels(ctx:AccessContext,companyId:string,ids:string[]){
  const rows=ids.length?await PartyListOption.find({tenantId:ctx.tenantId,companyId,_id:{$in:[...new Set(ids)].filter(id=>/^[a-f0-9]{24}$/i.test(id))}}).select('label'):[];
  return new Map(rows.map(row=>[String(row._id),row.label]));
 },
};
