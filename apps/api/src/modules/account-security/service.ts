import mongoose from 'mongoose';
import {createHash} from 'node:crypto';
import {User,Session,Membership} from '../identity/models.js';
import {hashPassword,verifyPassword,newSessionToken,tokenHash} from '../identity/security.js';
import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import {privacyPolicy,privacyVersion} from '../../../../../packages/contracts/src/privacy.js';
import {PasswordReset,PrivacyAcceptance,AccountAudit,RecoveryJob} from './models.js';
import {changePasswordInput,forgotPasswordInput,resetPasswordInput,privacyAcceptanceInput} from './input.js';
import type {RecoveryMailer} from './mail.js';
export class CredentialChangeRejected extends Error {}
export class ResetTokenRejected extends Error {}
const passwordVersionFilter=(version:number)=>version===0?{$or:[{passwordVersion:0},{passwordVersion:{$exists:false}}]}:{passwordVersion:version};
const documentHash=createHash('sha256').update(JSON.stringify(privacyPolicy)).digest('hex');
export const accountSecurityService={
 async changePassword(context:AccessContext,raw:unknown){
  const input=changePasswordInput.parse(raw);
  if(input.newPassword===input.currentPassword)throw new CredentialChangeRejected();
  const user=await User.findOne({_id:context.userId,active:true}).select('+passwordHash');
  if(!user||!await verifyPassword(input.currentPassword,user.passwordHash))throw new CredentialChangeRejected();
  const passwordHash=await hashPassword(input.newPassword),version=user.passwordVersion;
  await mongoose.connection.transaction(async session=>{
   const result=await User.updateOne({_id:user._id,...passwordVersionFilter(version),passwordHash:user.passwordHash},{$set:{passwordHash,mustChangePassword:false,passwordChangedAt:new Date()},$inc:{passwordVersion:1}},{session,runValidators:true});
   if(result.matchedCount!==1)throw new CredentialChangeRejected();
   await Session.deleteMany({userId:user._id},{session});await PasswordReset.deleteMany({_id:user._id},{session});await RecoveryJob.deleteMany({userId:user._id},{session});
   await AccountAudit.create([{tenantId:context.tenantId,userId:user._id,action:'password.changed'}],{session});
  });
 },
 async forgot(raw:unknown){
  const {email}=forgotPasswordInput.parse(raw),user=await User.findOne({email,active:true});
  const requestId=newSessionToken();
  const write=()=>RecoveryJob.findOneAndUpdate({_id:tokenHash(email)},{$set:{userId:user?._id??null,requestId,state:'pending',attempts:0,nextAttemptAt:new Date(),leaseUntil:new Date(0),expiresAt:new Date(Date.now()+3600000)}},{upsert:true,runValidators:true});
  try{await write();}catch(error){if((error as {code?:number}).code!==11000)throw error;await write();}
 },
 async reset(raw:unknown){
  const input=resetPasswordInput.parse(raw);
  const request=await PasswordReset.findOne({tokenHash:tokenHash(input.token),expiresAt:{$gt:new Date()}});
  if(!request)throw new ResetTokenRejected();
  const user=await User.findOne({_id:request._id,active:true,...passwordVersionFilter(request.passwordVersion)}).select('+passwordHash');
  if(!user||await verifyPassword(input.newPassword,user.passwordHash))throw new ResetTokenRejected();
  const passwordHash=await hashPassword(input.newPassword);
  await mongoose.connection.transaction(async session=>{
   const consumed=await PasswordReset.deleteOne({_id:request._id,tokenHash:tokenHash(input.token),expiresAt:{$gt:new Date()}},{session});
   if(consumed.deletedCount!==1)throw new ResetTokenRejected();
   const result=await User.updateOne({_id:user._id,active:true,passwordVersion:request.passwordVersion},{$set:{passwordHash,mustChangePassword:false,passwordChangedAt:new Date()},$inc:{passwordVersion:1}},{session,runValidators:true});
   if(result.matchedCount!==1)throw new ResetTokenRejected();
   await Session.deleteMany({userId:user._id},{session});await RecoveryJob.deleteMany({userId:user._id},{session});
   await AccountAudit.create([{userId:user._id,action:'password.reset'}],{session});
  });
 },
 async acceptPrivacy(context:AccessContext,raw:unknown){
  privacyAcceptanceInput.parse(raw);
  if(context.onboarding?.passwordChangeRequired)throw new CredentialChangeRejected();
  await mongoose.connection.transaction(async session=>{
   const member=await Membership.findOne({tenantId:context.tenantId,userId:context.userId,active:true}).session(session);
   if(!member)throw new CredentialChangeRejected();
   if(member.privacyVersion===privacyVersion)return;
   const acceptance=await PrivacyAcceptance.findOneAndUpdate({tenantId:context.tenantId,userId:context.userId,version:privacyVersion},{$setOnInsert:{documentHash,acceptedAt:new Date()}},{session,upsert:true,new:true,runValidators:true});
   await Membership.updateOne({_id:member._id,tenantId:context.tenantId},{$set:{privacyVersion,privacyAcceptedAt:acceptance!.acceptedAt}},{session,runValidators:true});
   await AccountAudit.create([{tenantId:context.tenantId,userId:context.userId,action:'privacy.accepted'}],{session});
  });
 },
};
