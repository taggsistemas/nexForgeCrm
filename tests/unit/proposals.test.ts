import {describe,it,expect} from 'vitest';
import {proposalLineCents,weightedCents,defaultPipelineStages} from '../../packages/contracts/src/opportunities.js';
import {proposalCreateInput,proposalUpdateInput,proposalActionInput,pipelineSettingsInput,createOpportunityInput,updateOpportunityInput} from '../../apps/api/src/modules/opportunities/input.js';
const id='a'.repeat(24);
describe('proposal money and inputs',()=>{
 it('computes line totals in integer cents with decimal quantities and rejects discounts above the line',()=>{
  expect(proposalLineCents('2',50000000,1000000)).toBe(99000000);
  expect(proposalLineCents('1.5',30001)).toBe(45002);expect(proposalLineCents('0.333',100)).toBe(33);expect(proposalLineCents('0.335',100)).toBe(34);
  for(const [quantity,price,discount] of [['1.2345',100,0],['-1',100,0],['01',100,0],['1',100,101],['1',-1,0],['1',1.5,0]] as const)expect(()=>proposalLineCents(quantity,price,discount)).toThrow();
 });
 it('weights the expected value for forecasting without turning it into revenue',()=>{
  expect(weightedCents(150000000,15)).toBe(22500000);expect(weightedCents(333,50)).toBe(167);expect(weightedCents(1000,0)).toBe(0);
  expect(Object.values(defaultPipelineStages).map(stage=>stage.probability)).toEqual([10,40,70]);
 });
 it('accepts only catalog items, quantities and prices; totals, numbers and statuses stay on the server',()=>{
  const item={productId:id,quantity:'2',unitPriceCents:100};
  expect(proposalCreateInput.parse({validUntil:'2031-01-31',items:[item]}).items[0]).toEqual({...item,discountCents:0});
  for(const extra of [{totalCents:1},{status:'aceita'},{number:'PR-1'},{revision:3},{items:[]},{items:[{...item,referencePriceCents:1}]},{items:[{...item,quantity:'0'}]},{validUntil:'2031-02-30'}])
   expect(proposalCreateInput.safeParse({validUntil:'2031-01-31',items:[item],...extra}).success).toBe(false);
  expect(proposalUpdateInput.safeParse({notes:'x'}).success).toBe(false);expect(proposalActionInput.parse({version:1})).toEqual({version:1,reason:''});
 });
 it('validates pipeline settings and opportunity probability',()=>{
  const stages=[{key:'descoberta',label:'Prospecção',probability:15},{key:'proposta',label:'Proposta',probability:50},{key:'negociacao',label:'Fechamento',probability:80}];
  expect(pipelineSettingsInput.safeParse({version:0,stages}).success).toBe(true);
  for(const bad of [stages.slice(0,2),[...stages.slice(0,2),{...stages[0]}],[{...stages[0],key:'ganha'},...stages.slice(1)],[{...stages[0],probability:101},...stages.slice(1)]])expect(pipelineSettingsInput.safeParse({version:0,stages:bad}).success).toBe(false);
  expect(createOpportunityInput.safeParse({partyId:id,title:'T',amountCents:1,expectedCloseDate:'2031-01-01',probability:101}).success).toBe(false);
  expect(updateOpportunityInput.safeParse({version:0,propertyId:null,equipmentId:null,probability:0}).success).toBe(true);
 });
});
