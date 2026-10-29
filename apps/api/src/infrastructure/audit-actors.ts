import {Membership,User} from '../modules/identity/models.js';
// Only call after authorizing the parent and loading tenant-scoped audit records.
// Include inactive/former members: suspension must not erase audit attribution.
export async function auditActorNames(tenantId:string,actorIds:readonly string[]){
 const ids=[...new Set(actorIds)];if(!ids.length)return new Map<string,string>();
 const members=await Membership.find({tenantId,userId:{$in:ids}}).select('userId');
 const users=await User.find({_id:{$in:members.map(member=>member.userId)}}).select('name');
 return new Map(users.map(user=>[String(user._id),user.name]));
}
export function auditActorLabel(names:ReadonlyMap<string,string>,id:string,currentUserId:string){const name=names.get(id);return name?name+(id===currentUserId?' (você)':''):'Usuário indisponível';}
