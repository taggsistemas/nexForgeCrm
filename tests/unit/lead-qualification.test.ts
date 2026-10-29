import {describe,it,expect} from 'vitest';
import {assertLeadQualified} from '../../apps/api/src/modules/relationships/qualification';
import {createPartyInput,listInput} from '../../apps/api/src/modules/relationships/input';
const complete={"name":"Acme","stage":"qualificado","contactName":"Ana Compras","legalName":"Acme Ltda","taxId":"11222333000181","phone":"42999999999","email":"contact@example.invalid","address":{"postalCode":"85010000","street":"Rua Teste","number":"100","neighborhood":"Centro","city":"Guarapuava","state":"PR","country":"Brasil"}};
describe('progressive lead qualification',()=>{
 it('accepts initial company and optional contact without fiscal data',()=>{
  const input=createPartyInput.parse({name:' Prospect ',contactName:' Maria '});
  expect(input.taxId).toBe('');expect(input.contactName).toBe('Maria');
  expect(()=>assertLeadQualified(input)).toThrow();
 });
 it('requires complete qualification and an explicit qualified stage',()=>{
  expect(()=>assertLeadQualified(complete)).not.toThrow();
  for(const field of ['contactName','legalName','taxId','email','phone'])expect(()=>assertLeadQualified({...complete,[field]:''})).toThrow();
  expect(()=>assertLeadQualified({...complete,stage:'novo'})).toThrow();
  expect(()=>assertLeadQualified({...complete,address:{...complete.address,city:''}})).toThrow();
  expect(()=>assertLeadQualified({...complete,taxId:'11222333000180'})).toThrow();
 });
 it('whitelists pipeline stages and rejects query injection',()=>{
  expect(listInput.parse({stage:'novo'}).stage).toBe('novo');
  expect(listInput.safeParse({stage:{$ne:'descartado'}}).success).toBe(false);
 });
});
