import mongoose from 'mongoose';
import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import {Region} from '../territories/models.js';
import {Equipment,Property} from './models.js';
import {InvalidReference} from './service.js';
type Ids={propertyId?:unknown;equipmentId?:unknown};
/**
 * Service location of an attendance: property and equipment of the same live customer, equipment on the property.
 * Equipment alone implies its property. New links must be active; unchanged ones are kept if archived later.
 * Mutates input.propertyId when it is derived from the equipment.
 */
export async function assertServiceLocation(ctx:AccessContext,companyId:string,partyId:unknown,input:Record<string,unknown>,current:Ids,session:mongoose.ClientSession){
 const same=(key:'propertyId'|'equipmentId')=>String(input[key]??'')===String(current[key]??'');
 if(input.equipmentId&&!same('equipmentId')){
  const item=await Equipment.findOne({_id:input.equipmentId,tenantId:ctx.tenantId,companyId,partyId,archived:false}).session(session);if(!item)throw new InvalidReference();
  if(!input.propertyId)input.propertyId=String(item.propertyId);
  if(String(input.propertyId)!==String(item.propertyId))throw new InvalidReference();
 }
 if(input.propertyId&&!same('propertyId')&&!await Property.exists({_id:input.propertyId,tenantId:ctx.tenantId,companyId,partyId,archived:false}).session(session))throw new InvalidReference();
 const propertyId=Object.hasOwn(input,'propertyId')?input.propertyId:current.propertyId,equipmentId=Object.hasOwn(input,'equipmentId')?input.equipmentId:current.equipmentId;
 if(equipmentId&&!propertyId)throw new InvalidReference();
 if(equipmentId&&same('equipmentId')&&!same('propertyId')&&!await Equipment.exists({_id:equipmentId,tenantId:ctx.tenantId,companyId,partyId,propertyId}).session(session))throw new InvalidReference();
}
export interface LocationNames{property:Map<string,{name:string;regionName:string;address:string}>;equipment:Map<string,string>}
/** Batch names for views. Lookups stay inside tenant/company; archived records are marked. */
export async function locationNames(ctx:AccessContext,companyId:string,rows:Ids[]):Promise<LocationNames>{
 const propertyIds=rows.flatMap(row=>row.propertyId?[String(row.propertyId)]:[]),equipmentIds=rows.flatMap(row=>row.equipmentId?[String(row.equipmentId)]:[]);
 const [properties,equipment]=await Promise.all([propertyIds.length?Property.find({tenantId:ctx.tenantId,companyId,_id:{$in:[...new Set(propertyIds)]}}).select('name regionId address archived'):[],equipmentIds.length?Equipment.find({tenantId:ctx.tenantId,companyId,_id:{$in:[...new Set(equipmentIds)]}}).select('brand model serialNumber archived'):[]]);
 const regionIds=properties.flatMap(row=>row.regionId?[row.regionId]:[]);
 const regions=new Map((regionIds.length?await Region.find({tenantId:ctx.tenantId,companyId,_id:{$in:regionIds}}).select('name'):[]).map(row=>[String(row._id),row.name]));
 return {
  property:new Map(properties.map(row=>[String(row._id),{name:row.name+(row.archived?' (arquivada)':''),regionName:row.regionId?regions.get(String(row.regionId))??'':'',address:[row.address?.street,row.address?.number,row.address?.neighborhood,row.address?.city,row.address?.state].filter(Boolean).join(', ')}])),
  equipment:new Map(equipment.map(row=>[String(row._id),[row.brand,row.model,row.serialNumber&&'série '+row.serialNumber].filter(Boolean).join(' ')+(row.archived?' (arquivado)':'')])),
 };
}
