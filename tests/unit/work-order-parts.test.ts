import {describe,it,expect} from 'vitest';
import {milliToQuantity,quantityToMilli} from '../../packages/contracts/src/technical.js';
import {workOrderPartInput} from '../../apps/api/src/modules/technical/input.js';
const id='a'.repeat(24);
describe('work order part ledger inputs',()=>{
 it('converts decimal quantities to integer thousandths without floating point drift',()=>{
  expect(quantityToMilli('1.25')).toBe(1250);expect(quantityToMilli('0.001')).toBe(1);expect(quantityToMilli('3')).toBe(3000);
  expect(milliToQuantity(1250,3)).toBe('1.25');expect(milliToQuantity(3000,0)).toBe('3');expect(milliToQuantity(0,3)).toBe('0');expect(milliToQuantity(-500,1)).toBe('-0.5');
  expect(quantityToMilli('0.1')+quantityToMilli('0.2')).toBe(quantityToMilli('0.3'));
  for(const value of ['1,5','-1','1.2345','01'])expect(()=>quantityToMilli(value)).toThrow();
 });
 it('accepts only product, kind, quantity and note; price, stock and actor stay on the server',()=>{
  expect(workOrderPartInput.parse({productId:id,kind:'devolucao',quantity:'2'})).toEqual({productId:id,kind:'devolucao',quantity:'2',note:''});
  for(const extra of [{quantity:'0'},{kind:'ajuste'},{referencePriceCents:100},{stockLocationId:id},{actorId:id},{createdAt:'2030-01-01T00:00:00Z'}])expect(workOrderPartInput.safeParse({productId:id,kind:'consumo',quantity:'1',...extra}).success).toBe(false);
 });
});
