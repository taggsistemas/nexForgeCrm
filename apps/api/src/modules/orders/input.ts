import {z} from 'zod';
import {objectId} from '../relationships/input.js';
import {calendarDate} from '../opportunities/input.js';
import {paymentMethods} from '../../../../../packages/contracts/src/qualification.js';
const quantity=z.string().trim().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/).refine(value=>Number(value)>0);
const itemInput=z.object({productId:objectId,quantity,unitPriceCents:z.number().int().min(0).max(1e12),discountCents:z.number().int().min(0).max(1e12).default(0)}).strict();
const terms=z.array(z.number().int().min(0).max(730)).min(1).max(12).refine(values=>new Set(values).size===values.length);
const commercialFields={expectedDeliveryDate:calendarDate,paymentMethod:z.enum(paymentMethods),paymentTermDays:terms,notes:z.string().trim().max(3000).default('')};
export const orderDirectInput=z.object({partyId:objectId,items:z.array(itemInput).min(1).max(100),...commercialFields}).strict();
export const orderFromProposalInput=z.object({proposalId:objectId,opportunityId:objectId,...commercialFields}).strict();
export const orderFromWorkOrderInput=z.object({workOrderId:objectId,...commercialFields}).strict();
export const orderUpdateInput=z.object({items:z.array(itemInput).min(1).max(100),...commercialFields}).partial().extend({version:z.number().int().min(0)}).strict();
export const orderActionInput=z.object({version:z.number().int().min(0),note:z.string().trim().max(1000).default('')}).strict();
export const orderInvoiceInput=z.object({version:z.number().int().min(0),number:z.string().trim().min(1).max(40),issueDate:calendarDate,amountCents:z.number().int().min(1).max(1e13)}).strict();
export const orderListInput=z.object({page:z.coerce.number().int().min(1).max(10000).default(1),status:z.enum(['open','rascunho','aguardando_aprovacao','confirmado','entregue','faturado','cancelado','all']).default('all'),partyId:objectId.optional(),search:z.string().trim().max(80).default('')}).strict();
export class OrderRuleRejected extends Error {constructor(readonly code:string){super(code);}}
