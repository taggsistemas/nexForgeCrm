import {dateParts,addCalendarDays} from '../../../../../packages/contracts/src/agenda.js';
export class AgendaRuleRejected extends Error {}
// Convert wall time through IANA rules. Gaps are rejected rather than silently moving an appointment.
export function wallTimeToInstant(local:string,timeZone:string){
 const expected=local.slice(0,16),target=Date.parse(expected+':00Z');
 if(!Number.isFinite(target))throw new AgendaRuleRejected();
 let guess=target;
 for(let attempt=0;attempt<5;attempt++){
  const instant=new Date(guess),parts=dateParts(instant,timeZone),seconds=new Intl.DateTimeFormat('en-GB',{timeZone,second:'2-digit'}).formatToParts(instant).find(part=>part.type==='second')!.value.padStart(2,'0'),actual=parts.date+'T'+parts.time+':'+seconds;
  if(actual===expected+':00')return instant;
  guess+=target-Date.parse(actual+'Z');
 }
 throw new AgendaRuleRejected();
}
export function dayBoundary(date:string,timeZone:string){
 for(let hour=0;hour<=3;hour++){try{return wallTimeToInstant(date+'T'+String(hour).padStart(2,'0')+':00',timeZone);}catch{}}
 throw new AgendaRuleRejected();
}
export function materializeOccurrences(startLocal:string,timeZone:string,rule:{frequency:string;interval:number;count:number}){
 if(!['none','daily','weekly','monthly'].includes(rule.frequency)||!Number.isInteger(rule.count)||rule.count<1||rule.count>52||!Number.isInteger(rule.interval)||rule.interval<1||rule.interval>12)throw new AgendaRuleRejected();
 const anchorDate=startLocal.slice(0,10),time=startLocal.slice(10),first=wallTimeToInstant(startLocal,timeZone),result:Date[]=[];
 for(let index=0;index<rule.count;index++){
  let date=anchorDate;
  if(rule.frequency==='daily'||rule.frequency==='weekly')date=addCalendarDays(anchorDate,index*rule.interval*(rule.frequency==='weekly'?7:1));
  if(rule.frequency==='monthly'){
   const anchor=new Date(anchorDate+'T12:00:00Z'),month=new Date(Date.UTC(anchor.getUTCFullYear(),anchor.getUTCMonth()+index*rule.interval,1,12)),last=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,0)).getUTCDate();
   month.setUTCDate(Math.min(anchor.getUTCDate(),last));date=month.toISOString().slice(0,10);
  }
  const instant=wallTimeToInstant(date+time,timeZone);
  if(instant.valueOf()-first.valueOf()>366*86400000)throw new AgendaRuleRejected();
  result.push(instant);
 }
 return result;
}
