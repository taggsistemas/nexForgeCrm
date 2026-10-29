import mongoose from 'mongoose';
import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import {companyScope,AccessDenied} from '../../infrastructure/access.js';
import {Membership,Role,User} from '../identity/models.js';
import {Region} from '../territories/models.js';
/** Derive technical supervision from current memberships; never from requested region/owner IDs. */
export async function technicalTeamAuthority(ctx:AccessContext,company:string,session?:mongoose.ClientSession){
 const scope=companyScope(ctx,company,'technical:read');
 if(ctx.dataAccess?.visibility==='company')return null;
 if(ctx.dataAccess?.visibility!=='team')throw new AccessDenied();
 const parentRoles=await Role.find({tenantId:ctx.tenantId,key:{$in:['supervisor','technical_coordinator']}}).select('_id').session(session??null);
 const actor=await Membership.findOne({...{tenantId:ctx.tenantId,userId:ctx.userId,companyIds:company,active:true},roleIds:{$in:parentRoles.map(role=>role._id)}}).session(session??null);
 if(!actor||!await User.exists({_id:ctx.userId,active:true}).session(session??null))throw new AccessDenied();
 if(session)await Membership.updateOne({_id:actor._id,tenantId:ctx.tenantId,active:true},{$inc:{commercialRevision:1}},{session});
 const regions=await Region.find({...scope,active:true,_id:{$in:actor.regionIds}}).select('_id').session(session??null);
 const technicianRoles=await Role.find({tenantId:ctx.tenantId,key:'technician'}).select('_id').session(session??null);
 const children=await Membership.find({tenantId:ctx.tenantId,companyIds:company,active:true,supervisorId:ctx.userId,roleIds:{$in:technicianRoles.map(role=>role._id)}}).select('userId').session(session??null);
 const users=await User.find({_id:{$in:children.map(child=>child.userId)},active:true}).select('_id').session(session??null);
 return {regionIds:regions.map(region=>region._id),technicianIds:users.map(user=>user._id)};
}
export function technicalAssignmentAllowed(authority:{regionIds:readonly {toString():string}[];technicianIds:readonly {toString():string}[]}|null,technicianId:string,regionId:string|null){
 return authority===null||Boolean(regionId&&authority.regionIds.some(id=>String(id)===regionId)&&authority.technicianIds.some(id=>String(id)===technicianId));
}

/** A company-wide read role must not widen the coordinator's management scope. */
export function technicalManagementContext(ctx:AccessContext):AccessContext{
 const visibility=ctx.dataAccess?.technicalManagementVisibility;
 return visibility?{...ctx,dataAccess:{...ctx.dataAccess!,visibility}}:ctx;
}
