import {describe,it,expect} from 'vitest';
import {equipmentCreateInput,equipmentUpdateInput,serialKey} from '../../apps/api/src/modules/relationships/input.js';
import {defaultPartyListOptions,partyListKinds} from '../../packages/contracts/src/relationships.js';
const property='c'.repeat(24);
describe('installed base inputs',()=>{
 it('normalizes serial numbers so case, spaces and separators do not create duplicates',()=>{
  expect(serialKey('GEA-0001 a')).toBe('GEA0001A');expect(serialKey(' tq 500/77 ')).toBe(serialKey('TQ-50077'));expect(serialKey('')).toBe('');
 });
 it('requires property, brand and model and rejects warranty before installation or server fields',()=>{
  expect(equipmentCreateInput.parse({propertyId:property,brand:'GEA',model:'R9500'})).toMatchObject({status:'em_operacao',serialNumber:'',categoryId:null,installedAt:null});
  for(const extra of [{brand:''},{status:'quebrado'},{installedAt:'2030-02-30'},{installedAt:'2030-01-02',warrantyUntil:'2030-01-01'},{serialKey:'X'},{partyId:property},{archived:true}])
   expect(equipmentCreateInput.safeParse({propertyId:property,brand:'GEA',model:'R9500',...extra}).success).toBe(false);
  expect(equipmentCreateInput.safeParse({brand:'GEA',model:'R9500'}).success).toBe(false);
  expect(equipmentUpdateInput.safeParse({status:'parado'}).success).toBe(false);expect(equipmentUpdateInput.safeParse({version:1,status:'parado'}).success).toBe(true);
 });
 it('offers a default equipment category list alongside customer classifications',()=>{
  expect(partyListKinds).toContain('equipmentCategory');expect(defaultPartyListOptions.equipmentCategory).toContain('Tanque de resfriamento');
 });
});
