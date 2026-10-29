import type {AccessContext} from '../../packages/contracts/src/index.js';
import type {PartyKind} from '../../packages/contracts/src/relationships.js';
import {companyScope} from '../../apps/api/src/infrastructure/access.js';
import {Party} from '../../apps/api/src/modules/relationships/models.js';
import {partyView,relationshipService} from '../../apps/api/src/modules/relationships/service.js';
// Domain suites seed synthetic pre-existing customers. Actual onboarding/approval is tested through the public API in relationships-mongo.
export async function seedRelationship(ctx:AccessContext,company:string,kind:PartyKind,input:Record<string,unknown>){
 if(kind==='lead')return relationshipService.create(ctx,company,kind,{phone:'42999999999',...input});
 const row=await Party.create({...companyScope(ctx,company,'customer:write'),ownerId:ctx.userId,kind:'customer',name:input.name,stage:'qualificado',address:{country:'Brasil'},...input});return partyView(row);
}
