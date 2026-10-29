import {describe,it,expect} from 'vitest';
import {visitPlanRange} from '../../packages/contracts/src/territories';
import {createRegionInput,createPortfolioInput,transferInput,createPlanInput,createPlanItemInput} from '../../apps/api/src/modules/territories/input';
import {profileDefinitions} from '../../packages/contracts/src/profiles';
describe('regions, portfolios and planning contracts',()=>{
 it('normalizes regional data and rejects scope/ownership injection',()=>{
  expect(createRegionInput.parse({name:' Centro ',state:'pr',cities:['Guarapuava']}).state).toBe('PR');
  expect(createRegionInput.safeParse({name:'R',tenantId:'b'}).success).toBe(false);
  expect(createRegionInput.safeParse({name:'R',state:'XX'}).success).toBe(false);
  expect(createPortfolioInput.safeParse({name:'C',ownerId:'a'.repeat(24),regionId:'invalid'}).success).toBe(false);
 });
 it('bounds atomic transfers and requires explicit versions without accepting a forged owner',()=>{
  const entry={partyId:'a'.repeat(24),version:0};
  expect(transferInput.safeParse({portfolioId:null,entries:[entry]}).success).toBe(true);
  for(const payload of [{portfolioId:null,entries:[]},{portfolioId:null,entries:[entry,entry]},{portfolioId:null,entries:[entry],ownerId:'b'.repeat(24)}])expect(transferInput.safeParse(payload).success).toBe(false);
 });
 it('derives canonical periods including calendar-year boundaries',()=>{
  expect(visitPlanRange('2027-01-01','weekly')).toEqual({startDate:'2026-12-28',endDate:'2027-01-04'});
  expect(visitPlanRange('2028-02-29','monthly')).toEqual({startDate:'2028-02-01',endDate:'2028-03-01'});
  expect(visitPlanRange('2027-05-02','quarterly')).toEqual({startDate:'2027-04-01',endDate:'2027-07-01'});
  expect(visitPlanRange('2027-12-31','semiannual')).toEqual({startDate:'2027-07-01',endDate:'2028-01-01'});
 });
 it('keeps plan ownership, publication and agenda timestamps server-owned',()=>{
  const valid={title:'Plano',portfolioId:'a'.repeat(24),period:'monthly',anchorDate:'2027-06-15',timeZone:'America/Sao_Paulo'};
  expect(createPlanInput.safeParse(valid).success).toBe(true);
  for(const change of [{ownerId:'b'.repeat(24)},{state:'published'},{endDate:'2030-01-01'},{anchorDate:'2027-02-30'}])expect(createPlanInput.safeParse({...valid,...change}).success).toBe(false);
  expect(createPlanItemInput.safeParse({partyId:'a'.repeat(24),startLocal:'2027-06-15T10:00',durationMinutes:30,objective:'Apresentar solução'}).success).toBe(true);
  expect(createPlanItemInput.safeParse({partyId:'a'.repeat(24),startLocal:'2027-06-15T10:00',durationMinutes:0,objective:'x'}).success).toBe(false);
 });
 it('allows supervised portfolio management without giving sellers assignment privileges',()=>{
  expect(profileDefinitions.seller.permissions).toContain('portfolio:read');
  expect(profileDefinitions.seller.permissions).not.toContain('portfolio:manage');
  expect(profileDefinitions.supervisor.permissions).toContain('portfolio:manage');
  expect(profileDefinitions.supervisor.permissions).not.toContain('region:manage');
 });
});
