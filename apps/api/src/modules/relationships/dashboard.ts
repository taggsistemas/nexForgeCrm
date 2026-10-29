import {z} from 'zod';
import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import type {DashboardChartsData} from '../../../../../packages/contracts/src/dashboard.js';
import {dateParts} from '../../../../../packages/contracts/src/agenda.js';
import {commercialFilter} from '../identity/profile-access.js';
import {Party} from './models.js';
import {wallTimeToInstant} from '../agenda/recurrence.js';
export function dashboardMonths(now:Date){const date=dateParts(now,'America/Sao_Paulo').date,year=Number(date.slice(0,4)),month=Number(date.slice(5,7));return Array.from({length:6},(_,i)=>new Date(Date.UTC(year,month-6+i,1,12)).toISOString().slice(0,7));}
export async function relationshipDashboard(context:AccessContext,companyId:string,raw:unknown,now=new Date()):Promise<DashboardChartsData>{
 z.object({}).strict().parse(raw);
 const kinds=[];if(context.permissions.includes('lead:read'))kinds.push('lead');if(context.permissions.includes('customer:read'))kinds.push('customer');
 const query=Party.find(commercialFilter(context,companyId,'company:read',{archived:false,kind:{$in:kinds}}));query.cast(Party);
 const months=dashboardMonths(now),start=wallTimeToInstant(months[0]+'-01T00:00','America/Sao_Paulo'),range={$gte:start,$lte:now};
 if(!kinds.length)return {asOf:now.toISOString(),months:months.map(month=>({month,created:0,approved:0})),qualification:[]};
 const [result]=await Party.aggregate([{$match:query.getFilter()},{$facet:{
  created:[{$match:{createdAt:range}},{$group:{_id:{$dateToString:{format:'%Y-%m',date:'$createdAt',timezone:'America/Sao_Paulo'}},total:{$sum:1}}}],
  approved:[{$match:{kind:'customer',qualificationState:'approved',approvedAt:range}},{$group:{_id:{$dateToString:{format:'%Y-%m',date:'$approvedAt',timezone:'America/Sao_Paulo'}},total:{$sum:1}}}],
  states:[{$group:{_id:{$ifNull:['$qualificationState','none']},total:{$sum:1}}}]
 }}]).option({maxTimeMS:10000});
 const totals=(rows:{_id:string;total:number}[]=[])=>new Map(rows.map(row=>[row._id,row.total]));const created=totals(result?.created),approved=totals(result?.approved),states=totals(result?.states);
 return {asOf:now.toISOString(),months:months.map(month=>({month,created:created.get(month)??0,approved:approved.get(month)??0})),qualification:['none','draft','submitted','revision','approved'].map(state=>({state,total:states.get(state)??0}))};
}
