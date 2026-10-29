import {lockSeats} from '../licensing/service.js';
import { assertAccountReady } from '../../infrastructure/account-gate.js';
import { AdministrationAudit } from './models.js';
import mongoose from 'mongoose';
import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import {profileDefinitions,profileKeys,type ProfileKey} from '../../../../../packages/contracts/src/profiles.js';
import {User,Tenant,Company,Membership,Role,Session} from '../identity/models.js';
import {hashPassword} from '../identity/security.js';
import {createUserInput,updateUserInput} from './input.js';
export class AdministrationDenied extends Error {}
export class AdministrationConflict extends Error {}
export class AdministrationInputError extends Error {}
async function check(context:AccessContext){
  assertAccountReady(context);
  if(!context.permissions.includes('user:manage')||!context.permissions.includes('role:manage'))throw new AdministrationDenied();
  const [tenant,membership]=await Promise.all([Tenant.findOne({_id:context.tenantId,active:true}),Membership.findOne({tenantId:context.tenantId,userId:context.userId,active:true})]);
  if(!tenant||!membership)throw new AdministrationDenied();
  return tenant;
}
async function ensureProfiles(tenantId:string,session:mongoose.ClientSession){
  const profiles=[];
  for(const key of profileKeys){
    const definition=profileDefinitions[key],name=key==='tenant_admin'?'Administrador':definition.name;
    profiles.push(await Role.findOneAndUpdate({tenantId,name},{$set:{key,permissions:[...definition.permissions]}},{upsert:true,new:true,runValidators:true,session}));
  }
  return profiles;
}
async function validateTeam(context:AccessContext,profileKey:ProfileKey,userIds:readonly string[],companyIds:readonly string[],session:mongoose.ClientSession){
  if(profileKey!=='supervisor'&&userIds.length)throw new AdministrationInputError();
  if(!userIds.length)return;
  const sellerRoles=await Role.find({tenantId:context.tenantId,key:'seller'}).session(session).select('_id');
  const members=await Membership.find({tenantId:context.tenantId,active:true,userId:{$in:userIds},roleIds:{$in:sellerRoles.map(role=>role._id)}}).session(session);
  const users=await User.countDocuments({_id:{$in:userIds},active:true}).session(session);
  if(members.length!==userIds.length||users!==userIds.length||members.some(member=>member.companyIds.some(id=>!companyIds.includes(String(id)))))throw new AdministrationInputError();
}
export const administrationService={
  async list(context:AccessContext){
    const tenant=await check(context);
    const memberships=await Membership.find({tenantId:context.tenantId}).sort({createdAt:1}).limit(500);
    const rows=[];
    for(const member of memberships){
      if(member.companyIds.some(id=>!context.companyIds.includes(String(id))))continue;
      const [user,roles]=await Promise.all([User.findById(member.userId).select('name email active mustChangePassword'),Role.find({tenantId:context.tenantId,_id:{$in:member.roleIds}})]);
      if(!user)continue;
      const key=roles.find(role=>role.key)?.key ?? (String(tenant.primaryAdminId)===String(user._id)?'tenant_admin':null);
      rows.push({id:String(user._id),name:user.name,email:user.email,active:member.active&&user.active,profileKey:key,profileName:key?profileDefinitions[key].name:roles.map(role=>role.name).join(', '),companyIds:member.companyIds.map(String),supervisedUserIds:member.supervisedUserIds.map(String),mustChangePassword:user.mustChangePassword,protected:String(user._id)===context.userId||String(user._id)===String(tenant.primaryAdminId)});
    }
    return {items:rows,profiles:profileKeys.map(key=>({key,...profileDefinitions[key]}))};
  },
  async create(context:AccessContext,raw:unknown){
    await check(context);
    const input=createUserInput.parse(raw);
    if(input.companyIds.some(id=>!context.companyIds.includes(id)))throw new AdministrationDenied();
    const passwordHash=await hashPassword(input.password);
    try{
      return await mongoose.connection.transaction(async session=>{
        await lockSeats(context.tenantId,session,true);
        const count=await Company.countDocuments({_id:{$in:input.companyIds},tenantId:context.tenantId,active:true}).session(session);
        if(count!==input.companyIds.length)throw new AdministrationInputError();
        if(await User.exists({email:input.email}).session(session))throw new AdministrationConflict();
        const profiles=await ensureProfiles(context.tenantId,session);
        await validateTeam(context,input.profileKey,input.supervisedUserIds,input.companyIds,session);
        const role=profiles.find(role=>role?.key===input.profileKey);
        if(!role)throw new AdministrationInputError();
        const [user]=await User.create([{name:input.name,email:input.email,passwordHash,mustChangePassword:true}],{session});
        await Membership.create([{tenantId:context.tenantId,userId:user._id,companyIds:input.companyIds,roleIds:[role._id],supervisedUserIds:input.supervisedUserIds}],{session});
        await AdministrationAudit.create([{tenantId:context.tenantId,actorId:context.userId,targetId:user._id,action:'user.created',profileKey:input.profileKey,active:true}],{session});
        return {id:String(user._id),name:user.name,email:user.email};
      });
    }catch(error){if((error as {code?:number}).code===11000)throw new AdministrationConflict();throw error;}
  },
  async update(context:AccessContext,userId:string,raw:unknown){
    const tenant=await check(context),input=updateUserInput.parse(raw);
    if(userId===context.userId||userId===String(tenant.primaryAdminId))throw new AdministrationDenied();
    if(input.supervisedUserIds.includes(userId))throw new AdministrationInputError();
    return mongoose.connection.transaction(async session=>{
      const member=await Membership.findOne({tenantId:context.tenantId,userId}).session(session);
      if(!member)return null;
      const companies=member.companyIds.map(String);
      if(companies.some(id=>!context.companyIds.includes(id)))throw new AdministrationDenied();
      await lockSeats(context.tenantId,session,!member.active&&input.active);
      const profiles=await ensureProfiles(context.tenantId,session);
      await validateTeam(context,input.profileKey,input.supervisedUserIds,companies,session);
      const role=profiles.find(role=>role?.key===input.profileKey);
      if(!role)throw new AdministrationInputError();
      await Membership.updateOne({_id:member._id,tenantId:context.tenantId},{$set:{active:input.active,roleIds:[role._id],supervisedUserIds:input.supervisedUserIds}},{session,runValidators:true});
      if(input.profileKey!=='seller'||!input.active) await Membership.updateMany({tenantId:context.tenantId,supervisedUserIds:userId},{$pull:{supervisedUserIds:userId}},{session});
      await Session.deleteMany({userId,tenantId:context.tenantId},{session});
      await AdministrationAudit.create([{tenantId:context.tenantId,actorId:context.userId,targetId:userId,action:'user.updated',profileKey:input.profileKey,active:input.active}],{session});
      return {id:userId,active:input.active,profileKey:input.profileKey};
    });
  },
};
