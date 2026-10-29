import {describe,expect,it,vi} from 'vitest';
import {createPartyInput,updatePartyInput,createContactInput} from '../../apps/api/src/modules/relationships/input';
import {changePasswordInput,resetPasswordInput,privacyAcceptanceInput} from '../../apps/api/src/modules/account-security/input';
import {assertAccountReady} from '../../apps/api/src/infrastructure/account-gate';
import {privacyVersion} from '../../packages/contracts/src/privacy';
import {orderStatuses,priceTableScopes} from '../../packages/contracts/src/commercial-roadmap';
import {createSmtpMailer} from '../../apps/api/src/modules/account-security/mail';
describe('relationship DTOs and account security contracts',()=>{
 it('normalizes fiscal/contact fields and refuses ownership or scope mass assignment',()=>{
  const result=createPartyInput.parse({name:' Acme ',taxId:'11.222.333/0001-81',phone:'(42) 99999-9999',email:'CONTACT@example.invalid'});
  expect(result.name).toBe('Acme');expect(result.taxId).toBe('11222333000181');expect(result.phone).toBe('42999999999');expect(result.email).toBe('contact@example.invalid');
  for(const change of [{tenantId:'b'},{companyId:'b'},{kind:'customer'},{archived:true},{permissions:['*']},{name:{$ne:null}},{taxId:'11222333000180'}])expect(createPartyInput.safeParse({name:'Acme',...change}).success).toBe(false);
  expect(createContactInput.safeParse({name:'Contact',ownerId:'a'.repeat(24)}).success).toBe(false);
 });
 it('requires explicit edit version and rejects unknown address fields',()=>{
  expect(updatePartyInput.safeParse({name:'Changed'}).success).toBe(false);
  expect(updatePartyInput.safeParse({name:'Changed',version:0}).success).toBe(true);
  expect(updatePartyInput.safeParse({version:0,address:{tenantId:'b'}}).success).toBe(false);
 });
 it('treats onboarding flags as backend restrictions',()=>{
  const context={userId:'u',tenantId:'t',companyIds:['c'],permissions:[]};
  expect(()=>assertAccountReady({...context,onboarding:{passwordChangeRequired:true,privacyAcceptanceRequired:true}})).toThrow('PASSWORD_CHANGE_REQUIRED');
  expect(()=>assertAccountReady({...context,onboarding:{passwordChangeRequired:false,privacyAcceptanceRequired:true}})).toThrow('PRIVACY_ACCEPTANCE_REQUIRED');
 });
 it('requires strong passwords, opaque token and affirmative current-version acknowledgment',()=>{
  expect(changePasswordInput.safeParse({currentPassword:'old',newPassword:'short'}).success).toBe(false);
  expect(resetPasswordInput.safeParse({token:'x',newPassword:'a-personal-password'}).success).toBe(false);
  expect(privacyAcceptanceInput.safeParse({version:privacyVersion,accepted:true}).success).toBe(true);
  expect(privacyAcceptanceInput.safeParse({version:privacyVersion,accepted:'true'}).success).toBe(false);
  expect(privacyAcceptanceInput.safeParse({version:'old',accepted:true}).success).toBe(false);
 });
 it('requires mail configuration without logging secrets or silently disabling TLS',()=>{
  expect(createSmtpMailer({})).toBeUndefined();
  expect(()=>createSmtpMailer({SMTP_PASSWORD:'test-only-secret'})).toThrow('SMTP_CONFIGURATION_INVALID');
  expect(typeof createSmtpMailer({SMTP_HOST:'smtp.example.invalid',SMTP_FROM:'crm@example.invalid',SMTP_USER:'user',SMTP_PASSWORD:'test-only-secret',SMTP_PORT:'587'})).toBe('function');
 });
 it('records future order and pricing scope without pretending they are operational',()=>{
  expect(orderStatuses).toEqual(['orcamento','aprovado','cancelado','producao_separacao','expedicao','despachado']);
  expect(priceTableScopes).toEqual(['global','cliente','tipo_cliente','vendedor','regiao','equipe']);
 });
});
