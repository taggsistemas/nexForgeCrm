export const includedLicenses=25;
export const trialDurationDays=30;
export interface SubscriptionView {mode:'paid'|'trial';licenseLimit:number;activeUsers:number;includedLicenses:25;extraLicenses:number;baseMonthlyCents:number|null;extraSeatMonthlyCents:number|null;extraMonthlyCents:number|null;estimatedMonthlyCents:number|null;trialStartedAt:string|null;trialEndsAt:string|null;expired:boolean;version:number}
export function monthlyEstimate(limit:number,base:number|null,extra:number|null){const extraLicenses=Math.max(0,limit-includedLicenses),extraMonthlyCents=extraLicenses===0?0:extra===null?null:extraLicenses*extra;return {extraLicenses,extraMonthlyCents,estimatedMonthlyCents:base===null||extraMonthlyCents===null?null:base+extraMonthlyCents};}
