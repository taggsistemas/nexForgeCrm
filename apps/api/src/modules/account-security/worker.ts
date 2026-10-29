import {RecoveryJob,PasswordReset} from './models.js';
import {User} from '../identity/models.js';
import {newSessionToken,tokenHash} from '../identity/security.js';
import type {RecoveryMailer} from './mail.js';
export async function dispatchPasswordRecovery(origin:string,mailer:RecoveryMailer){
 const now=new Date();
 const job=await RecoveryJob.findOneAndUpdate({expiresAt:{$gt:now},nextAttemptAt:{$lte:now},$or:[{state:'pending'},{state:'processing',leaseUntil:{$lte:now}}]},{$set:{state:'processing',leaseUntil:new Date(Date.now()+60000)},$inc:{attempts:1}},{new:true,sort:{nextAttemptAt:1}});
 if(!job)return false;
 const identity={_id:job._id,requestId:job.requestId};
 try{
  const user=job.userId?await User.findOne({_id:job.userId,active:true}):null;
  if(!user){await RecoveryJob.deleteOne(identity);return true;}
  const token=newSessionToken();
  if(!await RecoveryJob.exists({...identity,state:'processing'}))return true;
  await PasswordReset.findOneAndUpdate({_id:user._id},{$set:{tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+20*60000),passwordVersion:user.passwordVersion}},{upsert:true,runValidators:true});
  const url=new URL('/reset-password',origin);url.hash=new URLSearchParams({token}).toString();
  await mailer({to:user.email,url:url.toString(),expiresMinutes:20});
  await RecoveryJob.deleteOne(identity);
 }catch{
  console.error('PASSWORD_RECOVERY_DELIVERY_FAILED');
  if(job.attempts>=3)await RecoveryJob.deleteOne(identity);
  else await RecoveryJob.updateOne(identity,{$set:{state:'pending',nextAttemptAt:new Date(Date.now()+30000)}});
 }
 return true;
}
export function startPasswordRecoveryWorker(origin:string,mailer?:RecoveryMailer){
 let stopped=false,running:Promise<unknown>|undefined;
 const tick=()=>{if(!stopped&&mailer&&!running)running=dispatchPasswordRecovery(origin,mailer).catch(()=>console.error('PASSWORD_RECOVERY_WORKER_FAILED')).finally(()=>{running=undefined;});};
 const timer=mailer?setInterval(tick,2500):undefined;timer?.unref();
 return async()=>{stopped=true;if(timer)clearInterval(timer);await running;};
}
