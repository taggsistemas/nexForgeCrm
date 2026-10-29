import {describe,expect,it,vi} from 'vitest';
import {replaceSingleSession} from '../../apps/api/src/modules/identity/single-session';
import {profileDefinitions} from '../../packages/contracts/src/profiles';
import {commercialFilter,profileVisibility} from '../../apps/api/src/modules/identity/profile-access';
import {createUserInput} from '../../apps/api/src/modules/administration/input';
const context={userId:'u',tenantId:'t',companyIds:['c'],permissions:['lead:read'] as const,dataAccess:{visibility:'own' as const,supervisedUserIds:[]}};
describe('single session and access profiles',()=>{
  it('retries only the initial unique-slot race and propagates other failures',async()=>{
    const write=vi.fn().mockRejectedValueOnce({code:11000}).mockResolvedValueOnce({});
    await replaceSingleSession(write);expect(write).toHaveBeenCalledTimes(2);
    const fail=vi.fn().mockRejectedValue(new Error('offline'));
    await expect(replaceSingleSession(fail)).rejects.toThrow('offline');expect(fail).toHaveBeenCalledTimes(1);
  });
  it('distinguishes managerial approvals and technical administration',()=>{
    expect(profileDefinitions.manager.permissions).toContain('proposal:approve');
    expect(profileDefinitions.manager.permissions).not.toContain('user:manage');
    for(const key of ['seller','supervisor','sales_admin'] as const)expect(profileDefinitions[key].permissions).not.toContain('proposal:approve');
    expect(profileDefinitions.tenant_admin.permissions).toContain('role:manage');
    expect(profileVisibility(['seller','supervisor'])).toBe('team');
    expect(profileVisibility(['seller','manager'])).toBe('company');
  });
  it('requires verified data scope and composes immutable ownership constraints',()=>{
    expect(commercialFilter(context,'c','lead:read',{ownerId:'other'}).$and).toContainEqual({ownerId:{$in:['u']}});
    expect(()=>commercialFilter({...context,dataAccess:undefined},'c','lead:read')).toThrow();
    expect(()=>commercialFilter(context,'other-company','lead:read')).toThrow();
  });
  it('rejects frontend ownership, role injection and invalid company selections',()=>{
    const base={name:'Seller',email:'seller@example.invalid',password:'test-password-only',profileKey:'seller',companyIds:['a'.repeat(24)],supervisedUserIds:[]};
    expect(createUserInput.safeParse(base).success).toBe(true);
    for(const change of [{permissions:['*']},{roleIds:['b']},{tenantId:'b'},{profileKey:'taggmaster'},{companyIds:[]},{companyIds:['a'.repeat(24),'a'.repeat(24)]}])expect(createUserInput.safeParse({...base,...change}).success).toBe(false);
  });
});
