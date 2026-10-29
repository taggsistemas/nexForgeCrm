import {afterEach,describe,it,expect,vi} from 'vitest';
import {auditActorNames,auditActorLabel} from '../../apps/api/src/infrastructure/audit-actors.js';
import {Membership,User} from '../../apps/api/src/modules/identity/models.js';
const tenant='a'.repeat(24),own='b'.repeat(24),foreign='c'.repeat(24);
afterEach(()=>vi.restoreAllMocks());
describe('audit actor attribution',()=>{
 it('resolves only tenant members from authorized history, including former inactive users',async()=>{const members=vi.spyOn(Membership,'find').mockReturnValue({select:()=>Promise.resolve([{userId:own}])} as any),users=vi.spyOn(User,'find').mockReturnValue({select:()=>Promise.resolve([{_id:own,name:'Ana Revisora'}])} as any);const names=await auditActorNames(tenant,[own,foreign,own]);expect((members.mock.calls as unknown as unknown[][])[0]![0]).toEqual({tenantId:tenant,userId:{$in:[own,foreign]}});expect((users.mock.calls as unknown as unknown[][])[0]![0]).toEqual({_id:{$in:[own]}});expect(names.get(own)).toBe('Ana Revisora');expect(names.has(foreign)).toBe(false);expect(auditActorLabel(names,own,own)).toBe('Ana Revisora (você)');expect(auditActorLabel(names,own,foreign)).toBe('Ana Revisora');expect(auditActorLabel(names,foreign,own)).toBe('Usuário indisponível');});
 it('does not query user accounts for an empty history',async()=>{const spy=vi.spyOn(Membership,'find');expect((await auditActorNames(tenant,[])).size).toBe(0);expect(spy).not.toHaveBeenCalled();});
});
