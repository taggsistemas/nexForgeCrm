import {z} from 'zod';
import {paymentMethods,registrationStatuses} from '../../../../../packages/contracts/src/qualification.js';
import {updatePartyInput} from './input.js';
export const commercialInput=z.object({creditLimitCents:z.number().int().min(0).max(1e12),paymentMethods:z.array(z.enum(paymentMethods)).min(1).max(paymentMethods.length).refine(values=>new Set(values).size===values.length),paymentTermDays:z.array(z.number().int().min(0).max(730)).min(1).max(24).refine(values=>values.every((value,index)=>index===0||value>values[index-1]!)).refine(values=>values.length===1||!values.includes(0))}).strict();
export const qualificationDraftInput=updatePartyInput.omit({stage:true,ownerId:true}).extend({commercial:commercialInput.extend({paymentMethods:z.array(z.enum(paymentMethods)).max(paymentMethods.length).refine(values=>new Set(values).size===values.length)}).optional(),registrationStatus:z.enum(registrationStatuses).optional()}).strict();
export const qualificationActionInput=z.object({version:z.number().int().min(0)}).strict();
export const qualificationReturnInput=qualificationActionInput.extend({reason:z.string().trim().min(10).max(2000)}).strict();
export class QualificationWorkflowRequired extends Error {}
export class QualificationSelfApproval extends Error {}

