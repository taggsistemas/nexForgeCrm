import {describe,it,expect} from 'vitest';
import {createLeadInput,updateLeadInput} from '../../apps/api/src/modules/relationships/input.js';
import {commercialInput,qualificationDraftInput,qualificationReturnInput} from '../../apps/api/src/modules/relationships/qualification-input.js';
import {profileDefinitions} from '../../packages/contracts/src/profiles.js';
describe('qualification workflow boundaries',()=>{
 it('intake requires a name and a contact channel, without fiscal or commercial fields',()=>{
  expect(createLeadInput.parse({name:'Prospect',phone:'(42) 99999-9999'}).phone).toBe('42999999999');expect(createLeadInput.safeParse({name:'Prospect',email:'test@example.invalid'}).success).toBe(true);
  for(const change of [{},{taxId:'11222333000181'},{stage:'qualificado'},{commercial:{creditLimitCents:1000}},{qualificationState:'approved'}])expect(createLeadInput.safeParse({name:'Prospect',...(Object.keys(change).length?{phone:'42999999999'}:{}),...change}).success).toBe(false);
  expect(updateLeadInput.safeParse({version:0,taxId:'11222333000181'}).success).toBe(false);
 });
 it('separates preparation from approval permissions',()=>{
  expect(profileDefinitions.sales_admin.permissions).toContain('qualification:approve');expect(profileDefinitions.manager.permissions).toContain('qualification:approve');
  for(const role of ['seller','supervisor'] as const){expect(profileDefinitions[role].permissions).toContain('qualification:submit');expect(profileDefinitions[role].permissions).not.toContain('qualification:approve');}
 });
 it('enforces integer credit, bounded ordered terms, known distinct methods and return reason',()=>{
  const valid={creditLimitCents:0,paymentMethods:['pix'],paymentTermDays:[0]};expect(commercialInput.safeParse(valid).success).toBe(true);
  for(const extra of [{creditLimitCents:-1},{creditLimitCents:1.5},{paymentMethods:[]},{paymentMethods:['pix','pix']},{paymentTermDays:[30,15]},{paymentTermDays:[0,30]},{paymentTermDays:[731]},{approvedBy:'x'}])expect(commercialInput.safeParse({...valid,...extra}).success).toBe(false);
  expect(qualificationReturnInput.safeParse({version:0,reason:'corrigir'}).success).toBe(false);expect(qualificationReturnInput.safeParse({version:0,reason:'Completar endereço comercial'}).success).toBe(true);
 });
 it('rejects mass-assigned approval, owner, scope and state in draft',()=>{
  for(const extra of [{ownerId:'a'.repeat(24)},{stage:'qualificado'},{approvedAt:new Date().toISOString()},{qualificationState:'approved'},{tenantId:'a'.repeat(24)},{commercial:{creditLimitCents:{$gt:0}}}])expect(qualificationDraftInput.safeParse({version:0,...extra}).success).toBe(false);
 });
});
