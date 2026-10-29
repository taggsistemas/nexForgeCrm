import {z} from 'zod';
import {objectId} from '../relationships/input.js';
import {openTicketStatuses,ticketCriticalities,ticketOrigins} from '../../../../../packages/contracts/src/tickets.js';
const version=z.number().int().min(0);
const note=(min:number,max=3000)=>z.string().trim().min(min).max(max);
export const ticketCreateInput=z.object({partyId:objectId,propertyId:objectId,equipmentId:objectId.nullable().default(null),origin:z.enum(ticketOrigins),criticality:z.enum(ticketCriticalities),title:note(3,160),description:note(10),previousTicketId:objectId.nullable().default(null)}).strict();
export const ticketActionInputs={
 'first-response':z.object({version,note:note(3)}).strict(),
 assign:z.object({version,assigneeId:objectId,note:z.string().trim().max(1000).default('')}).strict(),
 deadline:z.object({version,agreedDeadline:z.iso.datetime({offset:true}).transform(value=>new Date(value)),note:z.string().trim().max(1000).default('')}).strict(),
 escalate:z.object({version,reason:note(10,1000),assigneeId:objectId.optional()}).strict(),
 status:z.object({version,status:z.enum(openTicketStatuses),note:z.string().trim().max(1000).default('')}).strict(),
 resolve:z.object({version,solution:note(10)}).strict(),
 cancel:z.object({version,reason:note(10,1000)}).strict(),
} as const;
export const ticketListInput=z.object({page:z.coerce.number().int().min(1).max(10000).default(1),status:z.enum(['open','closed','all']).default('open'),criticality:z.enum(ticketCriticalities).optional(),regionId:objectId.optional(),assigneeId:objectId.optional(),partyId:objectId.optional(),equipmentId:objectId.optional(),overdue:z.enum(['true','false']).default('false'),search:z.string().trim().max(80).default('')}).strict();
export const ticketOptionsInput=z.object({search:z.string().trim().max(80).default(''),partyId:objectId.optional()}).strict();
export const ticketSettingsInput=z.object({version,criticalities:z.array(z.object({key:z.enum(ticketCriticalities),label:z.string().trim().min(1).max(40)}).strict()).length(ticketCriticalities.length).refine(rows=>new Set(rows.map(row=>row.key)).size===rows.length)}).strict();
export class TicketRuleRejected extends Error {constructor(readonly code:string){super(code);}}
