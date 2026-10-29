import { describe, expect, it } from 'vitest';
import { customerRegistrationSchema, newClientSchema } from '../../apps/api/src/modules/platform/client-input';
import { validTaxId, maskTaxId, maskPhone, maskPostalCode, maskStateRegistration, validDate } from '../../packages/contracts/src/customer';
import { customerRegistrationFixture as data } from '../fixtures/customer';
describe('customer registration validation', () => {
  it('accepts numeric CPF/CNPJ and the published alphanumeric CNPJ example', () => {
    for (const value of ['529.982.247-25','11.222.333/0001-81','00.000.000/E08G-12']) expect(validTaxId(value)).toBe(true);
    for (const value of ['111.111.111-11','00.000.000/0000-00','11.222.333/0001-80','52998224724','123','!!11222333000181']) expect(validTaxId(value)).toBe(false);
  });
  it('normalizes fiscal, phone, postal and email fields before storage', () => {
    const result = customerRegistrationSchema.parse({ ...data, taxId:'11.222.333/0001-81', stateRegistration:'123.45678-90', phone:'(42) 99999-9999', contactEmail:' CONTACT@example.invalid ', address:{...data.address, postalCode:'85010-000', state:'pr'} });
    expect(result.taxId).toBe(data.taxId); expect(result.phone).toBe(data.phone);
    expect(result.stateRegistration).toBe('1234567890'); expect(result.contactEmail).toBe(data.contactEmail);
    expect(result.address.postalCode).toBe('85010000'); expect(result.address.state).toBe('PR');
  });
  it('rejects incomplete addresses, invalid UF/CEP, invalid contact and mass assignment', () => {
    for(const change of [{address:{...data.address,street:''}},{address:{...data.address,state:'XX'}},{address:{...data.address,postalCode:'123'}},{contactEmail:'not-email'},{phone:'(42) 99'},{phone:'abc42999999999'},{taxId:'11222333000180'},{isMaster:true}]) expect(customerRegistrationSchema.safeParse({...data,...change}).success).toBe(false);
  });
  it('accepts a manual foreign address without querying a Brazilian CEP', () => {
    expect(customerRegistrationSchema.safeParse({...data,address:{...data.address,country:'Portugal',state:'Lisboa',postalCode:'1000-001'}}).success).toBe(true);
  });
  it('validates real calendar dates and inclusive chronological contract dates', () => {
    expect(validDate('2026-02-30')).toBe(false); expect(validDate('2028-02-29')).toBe(true);
    for(const contract of [{start:'2026-12-31',end:'2026-01-01'},{start:'2026-02-30',end:'2026-12-31'},{start:'',end:''}]) expect(customerRegistrationSchema.safeParse({...data,contract}).success).toBe(false);
    expect(customerRegistrationSchema.safeParse({...data,contract:{start:'2026-01-01',end:'2026-01-01'}}).success).toBe(true);
  });
  it('requires registration along with administrator credentials', () => {
    const base={name:'Cliente',slug:'cliente',companyName:'Empresa',adminName:'Admin',adminEmail:'admin@example.invalid',adminPassword:'a-long-test-password'};
    expect(newClientSchema.safeParse(base).success).toBe(false);
    expect(newClientSchema.safeParse({...base,...data}).success).toBe(true);
    expect(newClientSchema.safeParse({...base,...data,adminPassword:'short'}).success).toBe(false);
  });
  it('formats national document, phone, CEP and state-specific IE', () => {
    expect(maskTaxId('11222333000181','CNPJ')).toBe('11.222.333/0001-81');
    expect(maskTaxId('00000000E08G12','CNPJ')).toBe('00.000.000/E08G-12');
    expect(maskTaxId('52998224725','CPF')).toBe('529.982.247-25');
    expect(maskPhone('42999999999')).toBe('(42) 99999-9999');
    expect(maskPhone('4233334444')).toBe('(42) 3333-4444');
    expect(maskPostalCode('85010000')).toBe('85010-000');
    expect(maskStateRegistration('1234567890','PR')).toBe('123.45678-90');
    expect(maskStateRegistration('isento','PR')).toBe('ISENTO');
    expect(maskStateRegistration('123456789012','SP')).toBe('123.456.789.012');
  });
});
