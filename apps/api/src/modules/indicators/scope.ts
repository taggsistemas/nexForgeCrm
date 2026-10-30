import mongoose from 'mongoose';
import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import {addCalendarDays,dateParts} from '../../../../../packages/contracts/src/agenda.js';
import {companyScope,AccessDenied} from '../../infrastructure/access.js';
import {commercialFilter} from '../identity/profile-access.js';
import {Party,Property} from '../relationships/models.js';
import {dayBoundary} from '../agenda/recurrence.js';
export const zone='America/Sao_Paulo';
export const oid=(id:string)=>new mongoose.Types.ObjectId(id);
export type Filters={tenant:mongoose.Types.ObjectId;company:mongoose.Types.ObjectId;from:Date;to:Date;regionId:string|null;ownerId:string|null};
/** Shared filters: São Paulo calendar period (default last 30 days, inclusive end), property-region territory and responsible. */
export function buildFilters(ctx:AccessContext,companyId:string,input:{startDate?:string;endDate?:string;regionId?:string;ownerId?:string}){
 const scope=companyScope(ctx,companyId,'company:read');
 const today=dateParts(new Date(),zone).date,endDate=input.endDate??today,startDate=input.startDate??addCalendarDays(endDate,-29);
 if(endDate<startDate)throw new AccessDenied();
 const filters:Filters={tenant:oid(scope.tenantId),company:oid(companyId),from:dayBoundary(startDate,zone),to:dayBoundary(addCalendarDays(endDate,1),zone),regionId:input.regionId??null,ownerId:input.ownerId??null};
 return {filters,startDate,endDate,today};
}
/** Parties with an active property in the filtered region, or null without a territory filter. */
export async function regionParties(filters:Filters){return filters.regionId?await Property.distinct('partyId',{tenantId:filters.tenant,companyId:filters.company,archived:false,regionId:oid(filters.regionId)}):null;}
/** Customers/leads of the live commercial scope; territory = customer has an active property in the region. */
export async function commercialParties(ctx:AccessContext,companyId:string,filters:Filters,extra:Record<string,unknown>={archived:false}){
 const kinds=[...(ctx.permissions.includes('lead:read')?['lead']:[]),...(ctx.permissions.includes('customer:read')?['customer']:[])];
 const inRegion=await regionParties(filters);
 const query=Party.find(commercialFilter(ctx,companyId,kinds.includes('lead')?'lead:read':'customer:read',{...extra,kind:{$in:kinds},...(filters.ownerId?{ownerId:filters.ownerId}:{}),...(inRegion?{_id:{$in:inRegion}}:{})}));query.cast(Party);
 return query.getFilter();
}
export const sum=(rows:{total?:number}[]|undefined)=>rows?.[0]?.total??0;
export const count=(rows:{count?:number}[]|undefined)=>rows?.[0]?.count??0;
