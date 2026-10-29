import {describe,it,expect} from 'vitest';
import {createLeadInput,createContactInput,updatePartyInput,updateLeadInput,listOptionCreateInput,listOptionUpdateInput} from '../../apps/api/src/modules/relationships/input.js';
import {criticalChanges} from '../../apps/api/src/modules/relationships/service.js';
import {defaultPartyListOptions,partyListKinds} from '../../packages/contracts/src/relationships.js';
import {profileDefinitions} from '../../packages/contracts/src/profiles.js';
const id='a'.repeat(24);
describe('stage three customer profile inputs',()=>{
 it('keeps lead intake minimal while accepting optional classification and a real calendar date',()=>{
  expect(createLeadInput.safeParse({name:'Fazenda',phone:'42999999999'}).success).toBe(true);
  expect(createLeadInput.parse({name:'Fazenda',phone:'42999999999',originId:id.toUpperCase(),nextActionDate:'2030-02-28'}).originId).toBe(id);
  for(const nextActionDate of ['2030-02-30','30/01/2030','2030-1-5'])expect(createLeadInput.safeParse({name:'Fazenda',phone:'42999999999',nextActionDate}).success).toBe(false);
  expect(createLeadInput.safeParse({name:'Fazenda',phone:'42999999999',taxId:'11444777000161'}).success).toBe(false);
  expect(updateLeadInput.safeParse({version:0,technicalOwnerId:id}).success).toBe(false);
  expect(updatePartyInput.safeParse({version:0,technicalOwnerId:null,originId:null,nextActionDate:null}).success).toBe(true);
 });
 it('accepts closed contact roles and channels and never a client-side consent timestamp',()=>{
  expect(createContactInput.parse({name:'Ana'})).toMatchObject({roles:[],preferredChannel:'',communicationConsent:false});
  expect(createContactInput.safeParse({name:'Ana',roles:['decisor','compras'],preferredChannel:'whatsapp',communicationConsent:true}).success).toBe(true);
  for(const extra of [{roles:['gerente']},{roles:['decisor','decisor']},{preferredChannel:'sms'},{consentAt:'2030-01-01T00:00:00Z'},{consentBy:id}])expect(createContactInput.safeParse({name:'Ana',...extra}).success).toBe(false);
 });
 it('records before and after only for critical fields',()=>{
  const before={name:'A',taxId:'',ownerId:'1',technicalOwnerId:null,classificationId:'x',notes:'n1',phone:'1'},after={...before,taxId:'52998224725',technicalOwnerId:'2',notes:'n2',phone:'2'};
  expect(criticalChanges(before,after)).toEqual([{field:'taxId',before:'',after:'52998224725'},{field:'technicalOwnerId',before:'',after:'2'}]);
  expect(criticalChanges(before,{...before})).toEqual([]);
 });
 it('ships default lists for every kind and limits list management to administration profiles',()=>{
  for(const kind of partyListKinds)expect(defaultPartyListOptions[kind].length).toBeGreaterThan(1);
  expect(listOptionCreateInput.safeParse({kind:'origin',label:'Rádio'}).success).toBe(true);expect(listOptionCreateInput.safeParse({kind:'region',label:'X'}).success).toBe(false);expect(listOptionUpdateInput.safeParse({label:'X'}).success).toBe(false);
  const managers=Object.entries(profileDefinitions).filter(([,profile])=>profile.permissions.includes('list:manage')).map(([key])=>key).sort();
  expect(managers).toEqual(['manager','sales_admin','tenant_admin']);
 });
});
