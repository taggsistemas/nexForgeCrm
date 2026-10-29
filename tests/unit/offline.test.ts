import {describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {operationInput,syncInput} from '../../apps/api/src/modules/offline/input.js';
const point={latitude:-25,longitude:-51,accuracy:10},base={operationId:randomUUID(),partyId:'a'.repeat(24),partyVersion:0,capturedAt:'2030-01-02T12:00:00Z'};
describe('offline operation inputs',()=>{
 it('allows only bounded explicit activities and refuses ownership, approval or tenant authority',()=>{
  const input={...base,kind:'activity',title:'Ligar',type:'ligacao',dueAt:base.capturedAt,notes:''};expect(operationInput.safeParse(input).success).toBe(true);
  for(const change of [{kind:'approve'},{tenantId:'x'},{ownerId:'x'},{type:'visita'},{partyVersion:{$ne:0}},{operationId:'not-a-uuid'},{completedAt:base.capturedAt}])expect(operationInput.safeParse({...input,...change}).success).toBe(false);
 });
 it('requires authorized positions and coherent reported times, without accepting a server receipt timestamp',()=>{
  const visit={...base,kind:'visit',activityId:'b'.repeat(24),activityVersion:0,observedInAt:'2030-01-02T11:00:00Z',observedOutAt:base.capturedAt,checkIn:point,checkOut:point,locationAuthorized:true,outcome:'realizada',notes:'Relato local',nextSteps:''};expect(operationInput.safeParse(visit).success).toBe(true);
  for(const change of [{activityVersion:undefined},{activityId:undefined},{locationAuthorized:false},{checkIn:{...point,latitude:91}},{observedInAt:'2030-01-03T00:00:00Z'},{observedInAt:'2029-12-31T00:00:00Z'},{receivedAt:base.capturedAt}])expect(operationInput.safeParse({...visit,...change}).success).toBe(false);
  expect(syncInput.safeParse({grantId:'a'.repeat(24),operation:visit,permissions:['*']}).success).toBe(false);
 });
});

