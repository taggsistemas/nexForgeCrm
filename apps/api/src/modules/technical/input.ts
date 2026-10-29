import {z} from 'zod';
import {objectId} from '../relationships/input.js';
import {calendarDate} from '../opportunities/input.js';
import {positionInput} from '../field-visits/input.js';
export const technicalListInput=z.object({date:calendarDate,page:z.coerce.number().int().min(1).max(100000).default(1)}).strict();
// A work order comes from a ticket (customer/location taken from it) or is scheduled maintenance on a property.
export const technicalCreateInput=z.object({title:z.string().trim().min(2).max(160),ticketId:objectId.optional(),partyId:objectId.optional(),propertyId:objectId.optional(),equipmentId:objectId.nullable().optional(),returnOfWorkId:objectId.nullable().optional(),serviceId:objectId,technicianId:objectId,startLocal:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),durationMinutes:z.number().int().min(15).max(480),notes:z.string().trim().max(2000).default('')}).strict().refine(value=>value.ticketId?!value.propertyId&&!value.equipmentId:Boolean(value.partyId&&value.propertyId),'Informe o chamado ou o cliente e a propriedade.');
export const technicalCheckIn=z.object({version:z.number().int().min(0),position:positionInput,locationAuthorized:z.literal(true)}).strict();
export const technicalCheckOut=technicalCheckIn.extend({diagnosis:z.string().trim().min(5).max(3000),solution:z.string().trim().min(5).max(3000),laborMinutes:z.number().int().min(1).max(1440),travelMinutes:z.number().int().min(0).max(1440),travelKm:z.number().int().min(0).max(2000)}).strict();
export const technicalClose=z.object({version:z.number().int().min(0),billableMinutes:z.number().int().min(0).max(10080),note:z.string().trim().max(1000).default('')}).strict();
export const technicalOrdersInput=z.object({ticketId:objectId.optional(),partyId:objectId.optional(),equipmentId:objectId.optional(),page:z.coerce.number().int().min(1).max(10000).default(1)}).strict();
export const technicalReason=z.object({version:z.number().int().min(0),reason:z.string().trim().min(10).max(1000)}).strict();
export class TechnicalRuleRejected extends Error {}

export const technicalOptionsInput=z.object({search:z.string().trim().max(80).default(''),page:z.coerce.number().int().min(1).max(100000).default(1),partyId:objectId.optional()}).strict();
