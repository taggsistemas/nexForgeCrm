import {z} from 'zod';
import {objectId} from '../relationships/input.js';
import {positionInput} from '../field-visits/input.js';
import {visitOutcomes} from '../../../../../packages/contracts/src/field-visits.js';
import {ticketCriticalities} from '../../../../../packages/contracts/src/tickets.js';
import {orderDirectInput} from '../orders/input.js';
const instant=z.iso.datetime({offset:true}).refine(value=>Number.isFinite(Date.parse(value)));
const version=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const common={operationId:z.uuid(),partyId:objectId,partyVersion:version,capturedAt:instant};
const activity=z.object({...common,kind:z.literal('activity'),title:z.string().trim().min(1).max(160),type:z.enum(['ligacao','email','reuniao','tarefa']),dueAt:instant,notes:z.string().trim().max(3000)}).strict();
const visit=z.object({...common,kind:z.literal('visit'),activityId:objectId.optional(),activityVersion:version.optional(),observedInAt:instant,observedOutAt:instant,checkIn:positionInput,checkOut:positionInput,locationAuthorized:z.literal(true),outcome:z.enum(visitOutcomes),notes:z.string().trim().min(1).max(3000),nextSteps:z.string().trim().max(2000)}).strict();
const orderFields=orderDirectInput.shape;
const order=z.object({...common,kind:z.literal('order'),items:orderFields.items,expectedDeliveryDate:orderFields.expectedDeliveryDate,paymentMethod:orderFields.paymentMethod,paymentTermDays:orderFields.paymentTermDays,notes:z.string().trim().max(3000),submit:z.boolean()}).strict();
const ticket=z.object({...common,kind:z.literal('ticket'),propertyId:objectId,equipmentId:objectId.nullable(),criticality:z.enum(ticketCriticalities),title:z.string().trim().min(3).max(160),description:z.string().trim().min(10).max(3000)}).strict();
export const operationInput=z.discriminatedUnion('kind',[activity,visit,order,ticket]).superRefine((value,ctx)=>{if(value.kind==='visit'){if(Boolean(value.activityId)!==(value.activityVersion!==undefined))ctx.addIssue({code:'custom',message:'Informe atividade e versão juntas.'});const duration=Date.parse(value.observedOutAt)-Date.parse(value.observedInAt);if(duration<0||duration>24*3600000||Date.parse(value.capturedAt)<Date.parse(value.observedOutAt))ctx.addIssue({code:'custom',message:'Horários do dispositivo incompatíveis.'});}});
export const syncInput=z.object({grantId:objectId,operation:operationInput}).strict();
export const prepareInput=z.object({ownerId:objectId.optional()}).strict();
export class OfflineConflict extends Error {}
export class OfflineRejected extends Error {constructor(public code:string){super(code);}}

