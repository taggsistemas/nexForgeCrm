import {z} from 'zod';
import {calendarDate} from '../opportunities/input.js';
import {objectId} from '../relationships/input.js';
import {timeZoneInput} from '../agenda/input.js';
import {visitOutcomes} from '../../../../../packages/contracts/src/field-visits.js';
export const positionInput=z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),accuracy:z.number().min(0).max(10000)}).strict();
const version=z.number().int().min(0);
export const dailyRouteInput=z.object({date:calendarDate.refine(value=>value>='1900-01-01'&&value<='2100-12-31'),timeZone:timeZoneInput,ownerId:objectId.optional(),page:z.coerce.number().int().min(1).max(100000).default(1)}).strict();
export const checkInInput=z.object({version,position:positionInput,locationAuthorized:z.literal(true)}).strict();
export const checkOutInput=z.object({version,position:positionInput,locationAuthorized:z.literal(true),outcome:z.enum(visitOutcomes),notes:z.string().trim().min(1).max(3000),nextSteps:z.string().trim().max(2000).default('')}).strict();
export const interruptInput=z.object({version,reason:z.string().trim().min(10).max(1000)}).strict();
export class FieldVisitRuleRejected extends Error {}

