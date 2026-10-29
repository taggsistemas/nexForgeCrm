import mongoose from 'mongoose';
import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import type {PartyKind,PropertyView} from '../../../../../packages/contracts/src/relationships.js';
import {AccessDenied} from '../../infrastructure/access.js';
import {Region} from '../territories/models.js';
import {Contact,Equipment,Party,Property} from './models.js';
import {addressInput,objectId,propertyCreateInput,propertyListInput,propertyUpdateInput,versionInput} from './input.js';
import {audit,InvalidReference,parent,RecordConflict,RecordNotFound} from './service.js';
const nameKey=(name:string)=>name.normalize('NFD').replace(/[̀-ͯ]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
const literal=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
async function transact<T>(fn:(session:mongoose.ClientSession)=>Promise<T>){try{return await mongoose.connection.transaction(fn);}catch(error){if((error as {code?:number}).code===11000)throw new RecordConflict();throw error;}}
/** Authorizes the live parent Party; writes also need the write permission of its current kind. */
export async function authorizedParty(ctx:AccessContext,companyId:string,partyId:string,write:boolean,session?:mongoose.ClientSession){
 const row=await parent(ctx,companyId,partyId,ctx.permissions.includes('lead:read')?'lead:read':'customer:read',session);
 if(write&&!ctx.permissions.includes(((row.kind as PartyKind)==='lead'?'lead:write':'customer:write')))throw new AccessDenied();
 if(session)await Party.updateOne({_id:row._id,tenantId:ctx.tenantId,companyId,archived:false},{$inc:{propertyRevision:1}},{session});
 return row;
}
async function views(ctx:AccessContext,companyId:string,rows:InstanceType<typeof Property>[]):Promise<PropertyView[]>{
 const regions=await Region.find({tenantId:ctx.tenantId,companyId,_id:{$in:rows.flatMap(row=>row.regionId?[row.regionId]:[])}}).select('name');
 const names=new Map(regions.map(region=>[String(region._id),region.name]));
 return rows.map(row=>{const address=row.address;return {id:String(row._id),partyId:String(row.partyId),name:row.name,regionId:row.regionId?String(row.regionId):null,regionName:row.regionId?names.get(String(row.regionId))??'Território indisponível':'',
  address:{postalCode:address.postalCode??'',street:address.street??'',number:address.number??'',complement:address.complement??'',neighborhood:address.neighborhood??'',city:address.city??'',state:address.state??'',country:address.country??'Brasil'},
  coordinates:row.coordinates?{latitude:row.coordinates.latitude,longitude:row.coordinates.longitude}:null,contactIds:row.contactIds.map(String),notes:row.notes,version:row.version,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()};});
}
/** A new territory must be an active region of the same company; an unchanged one is kept even if deactivated later. */
async function assertReferences(ctx:AccessContext,companyId:string,partyId:unknown,input:{regionId?:string|null;contactIds?:string[]},current:{regionId?:unknown}|null,session:mongoose.ClientSession){
 if(input.regionId&&String(current?.regionId??'')!==input.regionId&&!await Region.exists({_id:input.regionId,tenantId:ctx.tenantId,companyId,active:true}).session(session))throw new InvalidReference();
 if(input.contactIds?.length&&await Contact.countDocuments({_id:{$in:input.contactIds},tenantId:ctx.tenantId,companyId,partyId,archived:false}).session(session)!==input.contactIds.length)throw new InvalidReference();
}
function changes(before:Record<string,unknown>,after:Record<string,unknown>){
 const text=(value:unknown)=>value===null||value===undefined?'':String(value);
 const pick=(row:Record<string,unknown>)=>({name:row.name,regionId:row.regionId,city:(row.address as {city?:string}|undefined)?.city,coordinates:row.coordinates?`${(row.coordinates as {latitude:number}).latitude}, ${(row.coordinates as {longitude:number}).longitude}`:''});
 const a=pick(before),b=pick(after);
 return (Object.keys(a) as (keyof typeof a)[]).filter(key=>text(a[key])!==text(b[key])).map(key=>({field:key==='name'?'propertyName':key==='city'?'propertyCity':key==='regionId'?'propertyRegionId':'propertyCoordinates',before:text(a[key]),after:text(b[key])}));
}
/** Equipment must be moved or archived first, so the installed base never points to an archived property. */
export class PropertyHasEquipment extends Error {}
export const propertyService={
 async list(ctx:AccessContext,companyId:string,partyId:string,raw:unknown){
  const record=await authorizedParty(ctx,companyId,partyId,false),input=propertyListInput.parse(raw);
  const filter={tenantId:ctx.tenantId,companyId,partyId:record._id,archived:false,...(input.search?{name:{$regex:literal(input.search),$options:'i'}}:{})};
  const [rows,total]=await Promise.all([Property.find(filter).sort({name:1,_id:1}).skip((input.page-1)*20).limit(20),Property.countDocuments(filter)]);
  return {items:await views(ctx,companyId,rows),total,page:input.page,pageSize:20};
 },
 async create(ctx:AccessContext,companyId:string,partyId:string,raw:unknown){
  const input=propertyCreateInput.parse(raw);
  return transact(async session=>{
   const record=await authorizedParty(ctx,companyId,partyId,true,session);await assertReferences(ctx,companyId,record._id,input,null,session);
   const [row]=await Property.create([{...input,nameKey:nameKey(input.name),tenantId:ctx.tenantId,companyId,partyId:record._id}],{session});
   await audit(ctx,companyId,row!._id,'property.created',session,undefined,changes({},row!.toObject()));
   return (await views(ctx,companyId,[row!]))[0]!;
  });
 },
 async update(ctx:AccessContext,companyId:string,partyId:string,id:string,raw:unknown){
  objectId.parse(id);const parsed=propertyUpdateInput.parse(raw),{version}=parsed;
  const input:Record<string,unknown>=Object.fromEntries(Object.entries(parsed).filter(([key])=>key!=='version'&&Object.hasOwn(raw as object,key)));
  return transact(async session=>{
   const record=await authorizedParty(ctx,companyId,partyId,true,session);
   const old=await Property.findOne({_id:id,tenantId:ctx.tenantId,companyId,partyId:record._id,archived:false}).session(session);if(!old)throw new RecordNotFound();
   await assertReferences(ctx,companyId,record._id,input as {regionId?:string|null;contactIds?:string[]},old,session);
   if(Object.hasOwn(input,'address'))input.address=addressInput.parse({...old.toObject().address,...input.address as Record<string,unknown>});
   if(typeof input.name==='string')input.nameKey=nameKey(input.name);
   const row=await Property.findOneAndUpdate({_id:id,tenantId:ctx.tenantId,companyId,partyId:record._id,archived:false,version},{$set:input,$inc:{version:1}},{new:true,session,runValidators:true});
   if(!row)throw new RecordConflict();
   await audit(ctx,companyId,row._id,'property.updated',session,undefined,changes(old.toObject(),row.toObject()));
   return (await views(ctx,companyId,[row]))[0]!;
  });
 },
 async archive(ctx:AccessContext,companyId:string,partyId:string,id:string,raw:unknown){
  objectId.parse(id);const {version}=versionInput.parse(raw);
  return transact(async session=>{
   const record=await authorizedParty(ctx,companyId,partyId,true,session);
   if(await Equipment.exists({tenantId:ctx.tenantId,companyId,partyId:record._id,propertyId:id,archived:false}).session(session))throw new PropertyHasEquipment();
   const row=await Property.findOneAndUpdate({_id:id,tenantId:ctx.tenantId,companyId,partyId:record._id,archived:false,version},{$set:{archived:true},$inc:{version:1}},{new:true,session});
   if(!row){if(await Property.exists({_id:id,tenantId:ctx.tenantId,companyId,partyId:record._id,archived:false}).session(session))throw new RecordConflict();throw new RecordNotFound();}
   await audit(ctx,companyId,row._id,'property.archived',session);return {id};
  });
 },
};
