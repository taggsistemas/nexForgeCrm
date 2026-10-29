import type mongoose from 'mongoose';
import type {SubscriptionView} from '../../../../../packages/contracts/src/subscription.js';
import {monthlyEstimate} from '../../../../../packages/contracts/src/subscription.js';
import {Tenant,Membership} from '../identity/models.js';
import {LicenseLimitReached,SubscriptionExpired} from './input.js';
export function subscriptionExpired(tenant:InstanceType<typeof Tenant>,now=new Date()){return tenant.subscription.mode==='trial'&&(!tenant.subscription.trialEndsAt||now>=tenant.subscription.trialEndsAt);}
export async function subscriptionView(tenant:InstanceType<typeof Tenant>):Promise<SubscriptionView>{
 const value=tenant.subscription,activeUsers=await Membership.countDocuments({tenantId:tenant._id,active:true});return {mode:value.mode,licenseLimit:value.licenseLimit,activeUsers,includedLicenses:25,baseMonthlyCents:value.baseMonthlyCents??null,extraSeatMonthlyCents:value.extraSeatMonthlyCents??null,...monthlyEstimate(value.licenseLimit,value.baseMonthlyCents??null,value.extraSeatMonthlyCents??null),trialStartedAt:value.trialStartedAt?.toISOString()??null,trialEndsAt:value.trialEndsAt?.toISOString()??null,expired:subscriptionExpired(tenant),version:tenant.subscriptionVersion};
}
// Every seat mutation and master plan edit locks this same tenant document first.
export async function lockSeats(tenantId:string,session:mongoose.ClientSession,consume:boolean){
 const tenant=await Tenant.findOneAndUpdate({_id:tenantId,active:true},{$inc:{licenseRevision:1}},{new:true,session});if(!tenant||subscriptionExpired(tenant))throw new SubscriptionExpired();
 if(consume&&await Membership.countDocuments({tenantId,active:true}).session(session)>=tenant.subscription.licenseLimit)throw new LicenseLimitReached();return tenant;
}
