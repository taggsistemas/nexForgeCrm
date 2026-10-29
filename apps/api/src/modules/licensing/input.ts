import {z} from 'zod';
export const subscriptionInput=z.object({mode:z.enum(['paid','trial']).default('paid'),licenseLimit:z.number().int().min(25).max(10000).default(25),baseMonthlyCents:z.number().int().min(0).max(1e10).nullable().default(null),extraSeatMonthlyCents:z.number().int().min(0).max(1e8).nullable().default(null)}).strict();
export const updateSubscriptionInput=subscriptionInput.extend({version:z.number().int().min(0)}).strict();
export class LicenseLimitReached extends Error {}
export class SubscriptionExpired extends Error {}
export class SubscriptionConflict extends Error {}
export class SubscriptionRuleRejected extends Error {}
