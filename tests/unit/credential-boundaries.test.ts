import {describe,expect,it,vi} from 'vitest';
import {identityService} from '../../apps/api/src/modules/identity/service.js';
import {platformAuth} from '../../apps/api/src/modules/platform/auth.js';
import {User} from '../../apps/api/src/modules/identity/models.js';
import {PlatformAdmin} from '../../apps/api/src/modules/platform/models.js';
describe('runtime credential validation at service boundaries',()=>{
  it('rejects NoSQL objects even if an internal caller bypasses the HTTP DTO',async()=>{
    const user=vi.spyOn(User,'findOne'),master=vi.spyOn(PlatformAdmin,'findOne');
    try{
      for(const service of [identityService,platformAuth]){
        expect(await service.login({$ne:null} as unknown as string,'password')).toBeNull();
        expect(await service.login('user@example.invalid',{$gt:''} as unknown as string)).toBeNull();
      }
      expect(user).not.toHaveBeenCalled();expect(master).not.toHaveBeenCalled();
    }finally{user.mockRestore();master.mockRestore();}
  });
});
