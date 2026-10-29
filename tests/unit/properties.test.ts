import {describe,it,expect} from 'vitest';
import {propertyCreateInput,propertyUpdateInput} from '../../apps/api/src/modules/relationships/input.js';
const id='b'.repeat(24);
describe('property inputs',()=>{
 it('accepts a minimal property and normalizes typed coordinates to six decimals',()=>{
  expect(propertyCreateInput.parse({name:'Sítio'})).toMatchObject({regionId:null,coordinates:null,contactIds:[],notes:''});
  expect(propertyCreateInput.parse({name:'Sítio',coordinates:{latitude:-24.12345678,longitude:-50.1}}).coordinates).toEqual({latitude:-24.123457,longitude:-50.1});
 });
 it('rejects out-of-range or partial coordinates, duplicate contacts and server-owned fields',()=>{
  for(const extra of [{coordinates:{latitude:-91,longitude:0}},{coordinates:{latitude:0,longitude:181}},{coordinates:{latitude:0}},{coordinates:{latitude:0,longitude:0,accuracy:5}},{contactIds:[id,id]},{partyId:id},{tenantId:id},{archived:true},{nameKey:'x'}])
   expect(propertyCreateInput.safeParse({name:'Sítio',...extra}).success).toBe(false);
  expect(propertyCreateInput.safeParse({name:''}).success).toBe(false);
 });
 it('requires a version on updates and allows clearing territory and coordinates',()=>{
  expect(propertyUpdateInput.safeParse({name:'Sítio'}).success).toBe(false);
  expect(propertyUpdateInput.parse({version:2,regionId:null,coordinates:null,address:{city:'Carambeí'}})).toMatchObject({version:2,regionId:null,coordinates:null,address:{city:'Carambeí'}});
 });
});
