import mongoose from 'mongoose';
import type {AccessContext,Permission} from '../../../../../packages/contracts/src/index.js';
import {companyScope,AccessDenied} from '../../infrastructure/access.js';
import {commercialFilter} from '../identity/profile-access.js';
import {User,Membership,Role} from '../identity/models.js';
import {Party} from '../relationships/models.js';
import {objectId} from '../relationships/input.js';
import {RecordNotFound,RecordConflict} from '../relationships/service.js';
import {Portfolio,Region,TerritoryAudit,VisitPlan} from './models.js';
import {TerritoryRuleRejected} from './errors.js';
export const literal=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export const keyOf=(value:string)=>value.normalize('NFKC').toLocaleLowerCase('pt-BR').trim();
export const scope=(context:AccessContext,companyId:string,permission:Permission)=>{commercialFilter(context,companyId,permission);return companyScope(context,companyId,permission);};
export function partyFilter(context:AccessContext,companyId:string,permission:Permission,extra:Record<string,unknown>={}){
 const kinds:string[]=[];if(context.permissions.includes('lead:read'))kinds.push('lead');if(context.permissions.includes('customer:read'))kinds.push('customer');
 return commercialFilter(context,companyId,permission,{archived:false,kind:{$in:kinds},...extra});
}
export async function seller(context:AccessContext,companyId:string,id:string,session?:mongoose.ClientSession,touch=false){
 objectId.parse(id);const visibility=context.dataAccess;if(!visibility)throw new AccessDenied();
 if(visibility.visibility!=='company'&&id!==context.userId&&!(visibility.visibility==='team'&&visibility.supervisedUserIds.includes(id)))throw new TerritoryRuleRejected();
 const roles=await Role.find({tenantId:context.tenantId,key:'seller'}).session(session??null);
 const member=await Membership.findOne({tenantId:context.tenantId,userId:id,companyIds:companyId,active:true,roleIds:{$in:roles.map(row=>row._id)}}).session(session??null),user=await User.findOne({_id:id,active:true}).session(session??null);
 if(!member||!user)throw new TerritoryRuleRejected();
 if(touch&&session)await Membership.updateOne({_id:member._id,tenantId:context.tenantId},{$inc:{commercialRevision:1}},{session});
 return user;
}
export async function region(context:AccessContext,companyId:string,id:string|null,session:mongoose.ClientSession){
 if(!id)return null;
 const row=await Region.findOne({_id:id,tenantId:context.tenantId,companyId,active:true}).session(session);if(!row)throw new TerritoryRuleRejected();
 await Region.updateOne({_id:row._id,tenantId:context.tenantId,companyId},{$inc:{referenceRevision:1}},{session});return row;
}
export async function portfolio(context:AccessContext,companyId:string,id:string,permission:Permission,session?:mongoose.ClientSession,active=false){
 objectId.parse(id);const query=Portfolio.findOne(commercialFilter(context,companyId,permission,{_id:id,...(active?{active:true}:{})}));if(session)query.session(session);const row=await query;if(!row)throw new RecordNotFound();return row;
}
export async function party(context:AccessContext,companyId:string,id:string,permission:Permission,session?:mongoose.ClientSession){
 objectId.parse(id);const query=Party.findOne(partyFilter(context,companyId,permission,{_id:id}));if(session)query.session(session);const row=await query;if(!row)throw new RecordNotFound();return row;
}
export async function plan(context:AccessContext,companyId:string,id:string,permission:Permission,session?:mongoose.ClientSession){
 objectId.parse(id);const query=VisitPlan.findOne(commercialFilter(context,companyId,permission,{_id:id}));if(session)query.session(session);const row=await query;if(!row)throw new RecordNotFound();return row;
}
export async function audit(context:AccessContext,companyId:string,id:unknown,action:string,session:mongoose.ClientSession,extra:Record<string,unknown>={}){
 await TerritoryAudit.create([{tenantId:context.tenantId,companyId,actorId:context.userId,entityId:id,action,...extra}],{session});
}
export async function transact<T>(fn:(session:mongoose.ClientSession)=>Promise<T>):Promise<T>{try{return await mongoose.connection.transaction(fn);}catch(error){if((error as {code?:number}).code===11000)throw new RecordConflict();throw error;}}
