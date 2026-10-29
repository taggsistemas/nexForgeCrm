import {describe,it,expect} from 'vitest';
import {createOpportunityInput,updateOpportunityInput,calendarDate,createActivityInput,updateActivityInput} from '../../apps/api/src/modules/opportunities/input';
import {moneyToCents} from '../../packages/contracts/src/opportunities';
const valid={partyId:'a'.repeat(24),title:'Oferta',amountCents:123456,expectedCloseDate:'2027-06-30'};
describe('opportunity and activity input boundaries',()=>{
 it('validates calendar dates instead of accepting rollover',()=>{
  expect(calendarDate.safeParse('2028-02-29').success).toBe(true);
  for(const value of ['2027-02-29','2027-04-31','tomorrow','2027-13-01'])expect(calendarDate.safeParse(value).success).toBe(false);
 });
 it('uses integer cents and refuses scope, owner, currency and terminal state injection',()=>{
  expect(createOpportunityInput.parse(valid).amountCents).toBe(123456);
  for(const change of [{amountCents:12.3},{amountCents:0},{amountCents:-1},{amountCents:1e13},{amountCents:'100'},{ownerId:'b'},{tenantId:'b'},{companyId:'b'},{currency:'USD'},{closedAt:new Date()},{stage:'ganha'}])expect(createOpportunityInput.safeParse({...valid,...change}).success).toBe(false);
  expect(updateOpportunityInput.safeParse({stage:'ganha'}).success).toBe(false);
  expect(updateOpportunityInput.safeParse({version:0,partyId:'b'.repeat(24)}).success).toBe(false);
 });
 it('requires timestamp timezone, explicit edit version and server-generated completion',()=>{
  const activity={title:'Ligar',type:'ligacao',dueAt:'2027-06-01T15:00:00-03:00'};
  expect(createActivityInput.parse(activity).dueAt.toISOString()).toBe('2027-06-01T18:00:00.000Z');
  expect(createActivityInput.safeParse({...activity,dueAt:'2027-06-01T15:00'}).success).toBe(false);
  expect(createActivityInput.safeParse({...activity,status:'concluida'}).success).toBe(false);
  expect(updateActivityInput.safeParse({version:0,completedAt:'2027-01-01'}).success).toBe(false);
 });
 it('parses Brazilian currency without floating point rounding',()=>{
  expect(moneyToCents('1.234,56')).toBe(123456);expect(moneyToCents('0,01')).toBe(1);
  for(const value of ['0','-1','1,999','abc','Infinity','1e3','1,2,3','1.23','1.2.3'])expect(moneyToCents(value)).toBeUndefined();
 });
});
