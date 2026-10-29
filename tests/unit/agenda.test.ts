import {describe,it,expect} from 'vitest';
import {calendarRange,dateParts} from '../../packages/contracts/src/agenda';
import {agendaListInput,createAgendaInput,updateAgendaInput} from '../../apps/api/src/modules/agenda/input';
import {wallTimeToInstant,materializeOccurrences,dayBoundary} from '../../apps/api/src/modules/agenda/recurrence';
const zone='America/Sao_Paulo',valid={link:{source:'party',id:'a'.repeat(24)},title:'Ligar',type:'ligacao',startLocal:'2027-01-31T09:00',timeZone:zone};
describe('agenda date ranges, recurrence and trusted input',()=>{
 it('builds Monday-based weeks and 42-day month windows without browser timezone shifts',()=>{
  expect(calendarRange('2026-10-28','week')).toEqual({startDate:'2026-10-26',endDate:'2026-11-02'});
  expect(calendarRange('2026-11-30','month')).toEqual({startDate:'2026-10-26',endDate:'2026-12-07'});
  expect(calendarRange('2026-10-28','day')).toEqual({startDate:'2026-10-28',endDate:'2026-10-29'});
 });
 it('preserves wall clock and clamps each month from the original day',()=>{
  const dates=materializeOccurrences(valid.startLocal,zone,{frequency:'monthly',interval:1,count:3});
  expect(dates.map(date=>date.toISOString())).toEqual(['2027-01-31T12:00:00.000Z','2027-02-28T12:00:00.000Z','2027-03-31T12:00:00.000Z']);
 });
 it('respects historical IANA DST and rejects a nonexistent appointment time',()=>{
  const dates=materializeOccurrences('2018-10-28T09:00',zone,{frequency:'weekly',interval:1,count:2});
  expect(dates.map(date=>date.toISOString())).toEqual(['2018-10-28T12:00:00.000Z','2018-11-04T11:00:00.000Z']);
  expect(()=>wallTimeToInstant('2018-11-04T00:30',zone)).toThrow();
  expect(dateParts(dayBoundary('2018-11-04',zone),zone)).toEqual({date:'2018-11-04',time:'01:00'});
 });
 it('limits materialization horizon and recurrence counts',()=>{
  expect(()=>materializeOccurrences(valid.startLocal,zone,{frequency:'monthly',interval:12,count:3})).toThrow();
  expect(createAgendaInput.safeParse({...valid,recurrence:{frequency:'weekly',interval:0,count:2}}).success).toBe(false);
  expect(createAgendaInput.safeParse({...valid,recurrence:{frequency:'daily',count:53}}).success).toBe(false);
  expect(createAgendaInput.safeParse({...valid,recurrence:{frequency:'none',count:2}}).success).toBe(false);
 });
 it('rejects scope, timestamps, invalid date/time and recurrence editing injection',()=>{
  expect(createAgendaInput.safeParse(valid).success).toBe(true);
  for(const change of [{ownerId:'b'},{tenantId:'b'},{status:'concluida'},{completedAt:new Date()},{startLocal:'2027-02-30T09:00'},{timeZone:'untrusted'},{startLocal:'2027-01-01T24:00'}])expect(createAgendaInput.safeParse({...valid,...change}).success).toBe(false);
  expect(updateAgendaInput.safeParse({version:0,startLocal:valid.startLocal}).success).toBe(false);
  expect(updateAgendaInput.safeParse({version:0,seriesId:'a'.repeat(24)}).success).toBe(false);
  expect(updateAgendaInput.safeParse({version:0,recurrence:{frequency:'daily'}}).success).toBe(false);
 });
 it('requires an explicit bounded query and rejects owner/filter injection',()=>{
  const query={startDate:'2027-01-01',endDate:'2027-01-08',timeZone:zone};
  expect(agendaListInput.safeParse(query).success).toBe(true);
  for(const change of [{endDate:'2028-01-01'},{endDate:'2027-01-01'},{status:{$ne:'cancelada'}},{ownerId:{$ne:'a'}},{page:0}])expect(agendaListInput.safeParse({...query,...change}).success).toBe(false);
 });
});
