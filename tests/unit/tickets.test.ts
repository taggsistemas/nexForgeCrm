import {describe,it,expect} from 'vitest';
import {elapsedMinutes,ticketCriticalities} from '../../packages/contracts/src/tickets.js';
import {ticketActionInputs,ticketCreateInput,ticketListInput,ticketSettingsInput} from '../../apps/api/src/modules/tickets/input.js';
import {profileDefinitions,profileKeys} from '../../packages/contracts/src/profiles.js';
const id='a'.repeat(24),base={partyId:id,propertyId:id,origin:'telefone',criticality:'critico',title:'Robô parado',description:'Robô não inicia a ordenha.'};
describe('ticket rules',()=>{
 it('measures elapsed minutes only between recorded server instants',()=>{
  expect(elapsedMinutes('2030-01-01T10:00:00Z','2030-01-01T10:20:29Z')).toBe(20);expect(elapsedMinutes('2030-01-01T10:00:00Z',null)).toBeNull();expect(elapsedMinutes('2030-01-01T10:00:00Z','2030-01-01T09:00:00Z')).toBe(0);
 });
 it('requires property and description and never accepts instants, status or numbering from the client',()=>{
  expect(ticketCreateInput.parse(base)).toMatchObject({equipmentId:null,previousTicketId:null});
  for(const extra of [{propertyId:undefined},{description:'curta'},{criticality:'urgente'},{openedAt:'2030-01-01T00:00:00Z'},{status:'resolvido'},{number:'CH-1'},{assigneeId:id},{agreedDeadline:'2030-01-01T00:00:00Z'}])expect(ticketCreateInput.safeParse({...base,...extra}).success).toBe(false);
 });
 it('validates each triage action and the queue filters',()=>{
  expect(ticketActionInputs.resolve.safeParse({version:0,solution:'curto'}).success).toBe(false);expect(ticketActionInputs.cancel.safeParse({version:0,reason:'Aberto em duplicidade'}).success).toBe(true);
  expect(ticketActionInputs.status.safeParse({version:0,status:'resolvido'}).success).toBe(false);expect(ticketActionInputs.deadline.safeParse({version:0,agreedDeadline:'amanhã'}).success).toBe(false);
  expect(ticketActionInputs['first-response'].safeParse({version:0,note:'ok',firstResponseAt:'2030-01-01T00:00:00Z'}).success).toBe(false);
  expect(ticketListInput.parse({})).toMatchObject({status:'open',page:1,overdue:'false'});expect(ticketListInput.safeParse({regionId:'castro'}).success).toBe(false);
  expect(ticketSettingsInput.safeParse({version:0,criticalities:ticketCriticalities.map(key=>({key,label:key}))}).success).toBe(true);
 });
 it('lets only technical coordination (and the administrator) triage; technicians only read',()=>{
  const managers=profileKeys.filter(key=>profileDefinitions[key].permissions.includes('ticket:manage')).sort();expect(managers).toEqual(['technical_coordinator','tenant_admin']);
  expect(profileDefinitions.technician.permissions).toContain('ticket:read');expect(profileDefinitions.technician.permissions).not.toContain('ticket:write');
  for(const key of ['director','auditor'] as const){expect(profileDefinitions[key].permissions).toContain('ticket:read');expect(profileDefinitions[key].permissions).not.toContain('ticket:write');}
 });
});
