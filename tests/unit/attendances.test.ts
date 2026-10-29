import {describe,it,expect} from 'vitest';
import {createAgendaInput,updateAgendaInput,agendaListInput,attendanceInput} from '../../apps/api/src/modules/agenda/input.js';
import {dailyRouteInput} from '../../apps/api/src/modules/field-visits/input.js';
import {updateActivityInput} from '../../apps/api/src/modules/opportunities/input.js';
const id='a'.repeat(24),base={link:{source:'party',id},title:'Visita',type:'visita',startLocal:'2030-03-04T09:00',timeZone:'America/Sao_Paulo'};
describe('agenda location, outcome and territory inputs',()=>{
 it('accepts property, equipment and objective on new activities and keeps location optional',()=>{
  expect(createAgendaInput.parse(base)).toMatchObject({objective:''});
  expect(createAgendaInput.parse({...base,propertyId:id,equipmentId:null,objective:'Revisar'})).toMatchObject({propertyId:id,equipmentId:null,objective:'Revisar'});
  for(const extra of [{propertyId:'x'},{objective:'x'.repeat(501)},{result:'antecipado'},{regionId:id}])expect(createAgendaInput.safeParse({...base,...extra}).success).toBe(false);
 });
 it('records result and next action on updates but never completion timestamps from the client',()=>{
  expect(updateAgendaInput.safeParse({version:1,status:'concluida',result:'Feito',nextAction:'Retornar',equipmentId:id}).success).toBe(true);
  for(const extra of [{completedAt:'2030-01-01T00:00:00Z'},{fieldState:'completed'},{result:'x'.repeat(2001)}])expect(updateAgendaInput.safeParse({version:1,...extra}).success).toBe(false);
  expect(updateActivityInput.safeParse({version:1,result:'Feito',nextAction:'Retornar'}).success).toBe(true);expect(updateActivityInput.safeParse({version:1,propertyId:id}).success).toBe(false);
 });
 it('filters agenda, field route and attendances by validated IDs',()=>{
  expect(agendaListInput.safeParse({startDate:'2030-03-01',endDate:'2030-03-31',timeZone:'America/Sao_Paulo',regionId:id}).success).toBe(true);
  expect(agendaListInput.safeParse({startDate:'2030-03-01',endDate:'2030-03-31',timeZone:'America/Sao_Paulo',regionId:'castro'}).success).toBe(false);
  expect(dailyRouteInput.safeParse({date:'2030-03-10',timeZone:'America/Sao_Paulo',regionId:id}).success).toBe(true);
  expect(attendanceInput.parse({propertyId:id})).toEqual({page:1,propertyId:id});expect(attendanceInput.safeParse({partyId:id}).success).toBe(false);
 });
});
