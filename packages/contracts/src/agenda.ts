import type {OpportunityActivityView} from './opportunities.js';
export const agendaTimeZones=['America/Sao_Paulo','America/Manaus','America/Rio_Branco','America/Noronha','America/Belem','America/Cuiaba','America/Campo_Grande'] as const;
export const recurrenceFrequencies=['none','daily','weekly','monthly'] as const;
export type AgendaSource='party'|'opportunity';
export interface AgendaActivityView extends OpportunityActivityView{offlineCapturedAt?:string;source:AgendaSource;partyId:string;partyName:string;ownerId:string;ownerName:string;opportunityTitle:string;seriesId?:string;propertyId:string|null;propertyName:string;regionName:string;equipmentId:string|null;equipmentName:string}
export interface AgendaSeriesView{id:string;frequency:string;interval:number;count:number;timeZone:string;state:'active'|'cancelled';version:number}
export function dateParts(value:Date,timeZone:string){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(value);
 const part=(type:string)=>parts.find(item=>item.type===type)!.value;
 return {date:part('year')+'-'+part('month')+'-'+part('day'),time:part('hour')+':'+part('minute')};
}
export function addCalendarDays(date:string,days:number){const value=new Date(date+'T12:00:00Z');value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);}
export function calendarRange(date:string,view:'day'|'week'|'month'){
 if(view==='day')return {startDate:date,endDate:addCalendarDays(date,1)};
 const day=new Date((view==='month'?date.slice(0,7)+'-01':date)+'T12:00:00Z');
 const startDate=addCalendarDays(day.toISOString().slice(0,10),-((day.getUTCDay()+6)%7));
 return {startDate,endDate:addCalendarDays(startDate,view==='week'?7:42)};
}
/** Attendance on a customer, property or equipment: agenda record plus field outcome when executed. */
export interface AttendanceView{id:string;source:AgendaSource;title:string;type:string;status:string;dueAt:string;completedAt:string|null;ownerName:string;opportunityTitle:string;propertyId:string|null;propertyName:string;equipmentId:string|null;equipmentName:string;objective:string;result:string;nextAction:string;fieldOutcome:string|null}
