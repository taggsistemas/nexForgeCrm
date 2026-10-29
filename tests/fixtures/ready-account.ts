import {User,Membership} from '../../apps/api/src/modules/identity/models.js';
import {privacyVersion} from '../../packages/contracts/src/privacy.js';
// Mature account fixture for domain tests. First-login behavior has its own suite.
export async function prepareAccount(email:string){
 const user=await User.findOne({email});if(!user)throw Error('Missing fixture account');
 await User.updateOne({_id:user._id},{$set:{mustChangePassword:false}});
 await Membership.updateMany({userId:user._id},{$set:{privacyVersion,privacyAcceptedAt:new Date()}});
}
