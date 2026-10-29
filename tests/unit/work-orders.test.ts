import {describe,it,expect} from 'vitest';
import {technicalCreateInput,technicalCheckOut,technicalClose,technicalOrdersInput} from '../../apps/api/src/modules/technical/input.js';
import {formatMinutes} from '../../packages/contracts/src/technical.js';
const id='a'.repeat(24),base={title:'Reparo',serviceId:id,technicianId:id,startLocal:'2030-01-02T09:00',durationMinutes:60};
const position={latitude:-24.7,longitude:-50,accuracy:10};
describe('work order inputs',()=>{
 it('requires a ticket or customer and property, never both a ticket and an explicit location',()=>{
  expect(technicalCreateInput.safeParse({...base,ticketId:id}).success).toBe(true);
  expect(technicalCreateInput.safeParse({...base,partyId:id,propertyId:id,equipmentId:null}).success).toBe(true);
  for(const extra of [{partyId:id},{},{ticketId:id,propertyId:id},{ticketId:id,equipmentId:id},{partyId:id,propertyId:id,number:'OS-1'},{partyId:id,propertyId:id,origin:'chamado'}])expect(technicalCreateInput.safeParse({...base,...extra}).success).toBe(false);
 });
 it('keeps execution, travel and billable records separate and server-stamped',()=>{
  const finish={version:1,position,locationAuthorized:true,diagnosis:'Falha na placa',solution:'Placa trocada',laborMinutes:90,travelMinutes:40,travelKm:35};
  expect(technicalCheckOut.safeParse(finish).success).toBe(true);
  for(const extra of [{laborMinutes:0},{travelKm:-1},{diagnosis:'x'},{billableMinutes:30},{checkedOutAt:'2030-01-01T00:00:00Z'},{result:'antigo'}])expect(technicalCheckOut.safeParse({...finish,...extra}).success).toBe(false);
  expect(technicalClose.parse({version:2,billableMinutes:0})).toEqual({version:2,billableMinutes:0,note:''});expect(technicalClose.safeParse({version:2,billableMinutes:30,closedAt:'2030-01-01T00:00:00Z'}).success).toBe(false);
  expect(technicalOrdersInput.safeParse({equipmentId:id,technicianId:id}).success).toBe(false);
 });
 it('formats minutes for the four records',()=>{expect(formatMinutes(null)).toBe('—');expect(formatMinutes(45)).toBe('45 min');expect(formatMinutes(90)).toBe('1 h 30 min');expect(formatMinutes(120)).toBe('2 h');});
});
