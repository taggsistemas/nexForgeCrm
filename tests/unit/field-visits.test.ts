import {describe,it,expect} from 'vitest';
import {checkInInput,checkOutInput,dailyRouteInput,interruptInput} from '../../apps/api/src/modules/field-visits/input.js';
const position={latitude:-25.39,longitude:-51.46,accuracy:12};
describe('field visit inputs reject frontend authority and malformed location',()=>{
 it('requires explicit location authorization and bounded numeric coordinates',()=>{
  expect(checkInInput.parse({version:0,position,locationAuthorized:true}).position).toEqual(position);
  for(const extra of [{locationAuthorized:false},{position:{...position,latitude:91}},{position:{...position,longitude:-181}},{position:{...position,accuracy:-1}},{position:{...position,accuracy:10001}},{position:{...position,latitude:'-25'}},{position:{...position,latitude:NaN}},{position:{...position,recordedAt:'2000-01-01'}}])expect(checkInInput.safeParse({version:0,position,locationAuthorized:true,...extra}).success).toBe(false);
 });
 it('rejects tenant, owner, timestamps, state and mongo operators',()=>{
  for(const extra of [{tenantId:'a'.repeat(24)},{ownerId:'b'.repeat(24)},{checkedInAt:'2000-01-01'},{state:'completed'},{version:{$ne:0}}])expect(checkInInput.safeParse({version:0,position,locationAuthorized:true,...extra}).success).toBe(false);
 });
 it('requires a real result and report, with a separate justified interruption',()=>{
  const input={version:0,position,locationAuthorized:true,outcome:'realizada',notes:'Apresentação realizada'};
  expect(checkOutInput.safeParse(input).success).toBe(true);
  expect(checkOutInput.safeParse({...input,notes:'   '}).success).toBe(false);
  expect(checkOutInput.safeParse({...input,outcome:'ganha'}).success).toBe(false);
  expect(interruptInput.safeParse({version:0,reason:'GPS indisponível no local'}).success).toBe(true);
  expect(interruptInput.safeParse({version:0,reason:'curto'}).success).toBe(false);
 });
 it('validates the day and timezone without accepting arbitrary route filters',()=>{
  const input={date:'2030-01-02',timeZone:'America/Sao_Paulo'};
  expect(dailyRouteInput.parse(input).page).toBe(1);
  for(const extra of [{date:'2030-02-30'},{date:'9999-12-31'},{timeZone:'invalid'},{ownerId:{$ne:null}},{tenantId:'x'},{page:0}])expect(dailyRouteInput.safeParse({...input,...extra}).success).toBe(false);
 });
});

