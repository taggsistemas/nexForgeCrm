import type {AccessContext} from '../../../../packages/contracts/src/index.js';
export class AccountRestricted extends Error {
 constructor(public code:'PASSWORD_CHANGE_REQUIRED'|'PRIVACY_ACCEPTANCE_REQUIRED'){super(code);}
}
export function assertAccountReady(context:AccessContext){
 if(context.onboarding?.passwordChangeRequired)throw new AccountRestricted('PASSWORD_CHANGE_REQUIRED');
 if(context.onboarding?.privacyAcceptanceRequired)throw new AccountRestricted('PRIVACY_ACCEPTANCE_REQUIRED');
}
