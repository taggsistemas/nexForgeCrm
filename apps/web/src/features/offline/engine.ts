import type {OfflinePayload,OfflineSnapshot,OfflineSyncResult} from '../../../../../packages/contracts/src/offline';
import {downloadSnapshot,sessionIdentity,syncOperation,OfflineHttpError} from './api';
import {announce,blockVault,clearVault,createVault,leaseValid,openVault,ownerTag,readEnvelope,unblockVault,updateVault,type QueueEntry,type VaultData} from './vault';
export type EngineAccount={user:{id?:string;name:string};tenant:{id?:string;name:string};companies:{id:string;name:string}[];permissions?:string[]};
export interface EngineStatus {phase:'idle'|'syncing'|'offline'|'attention';pending:number;message:string;lastSyncAt:string|null}
let status:EngineStatus={phase:'idle',pending:0,message:'',lastSyncAt:null},running:Promise<void>|null=null;
const listeners=new Set<(value:EngineStatus)=>void>();
function publish(next:Partial<EngineStatus>){status={...status,...next};for(const listener of listeners)listener(status);}
export function engineStatus(){return status;}
export function subscribe(listener:(value:EngineStatus)=>void){listeners.add(listener);listener(status);return ()=>{listeners.delete(listener);};}
const offlineError=(error:unknown)=>error instanceof TypeError||(error as Error)?.name==='TimeoutError'||(error as Error)?.name==='AbortError'||error instanceof OfflineHttpError&&(error.status>=500||[408,429].includes(error.status));
const pendingCount=(data:VaultData)=>data.queue.filter(item=>['pending','conflict','rejected'].includes(item.state)).length+(data.draftVisit?1:0);
/** Profiles that capture commercial field work offline (sellers, supervisors, sales administration). Technicians never receive commercial grants. */
export function offlineEnabled(account:EngineAccount|null|undefined){return Boolean(account?.permissions?.includes('activity:write'));}
/** Downloads the current portfolio for the signed-in user, keeping the queue and an open visit draft. Larger scopes fall back to the user's own portfolio. */
async function refresh(account:EngineAccount):Promise<VaultData|null>{
 const userId=account.user.id!,tenantId=account.tenant.id!,tag=await ownerTag(tenantId,userId),envelope=await readEnvelope();
 if(envelope&&envelope.ownerTag!==tag){
  if(envelope.pendingCount>0){publish({phase:'attention',message:'Há registros offline de outro usuário neste aparelho. Entre com aquele usuário para sincronizá-los ou apague-os em Operação offline.'});return null;}
  await clearVault();
 }
 const current=envelope?.ownerTag===tag?await openVault():null,company=current?.data.snapshot.identity.companyId&&account.companies.some(item=>item.id===current.data.snapshot.identity.companyId)?current.data.snapshot.identity.companyId:account.companies[0]?.id;
 if(!company)return null;
 let snapshot:OfflineSnapshot;
 try{snapshot=await downloadSnapshot(company,'');}catch(error){if(error instanceof OfflineHttpError&&error.code==='OFFLINE_SCOPE_TOO_LARGE')snapshot=await downloadSnapshot(company,userId);else throw error;}
 if(snapshot.identity.userId!==userId||snapshot.identity.tenantId!==tenantId)throw new OfflineHttpError(403,'IDENTITY_CHANGED');
 if(Math.abs(Date.now()-Date.parse(snapshot.issuedAt))>5*60000){publish({phase:'attention',message:'O relógio do aparelho está diferente do servidor. Ajuste data e hora para registrar offline.'});}
 if(!current){const created=await createVault({version:2,snapshot,queue:[],draftVisit:null,lastSyncAt:null,lastSeenAt:Date.now()},tag,envelope?.ownerTag===tag?envelope:null);return created.data;}
 await unblockVault();
 return (await updateVault(data=>({...data,snapshot,lastSeenAt:Date.now()}))).data;
}
/** Sends pending items in order. Confirmed conflicts/rejections are kept for review; network loss stops and keeps the same operation IDs. */
async function flush(data:VaultData){
 const company=data.snapshot.identity.companyId;
 for(const item of data.queue){
  if(item.state!=='pending')continue;
  let next:Partial<QueueEntry>;
  try{const result=await syncOperation(company,item.grantId,item.payload) as OfflineSyncResult;next={state:'applied',entityId:result.entityId,code:'',number:result.number,status:result.status};}
  catch(error){if(offlineError(error)||error instanceof OfflineHttpError&&error.status===401)throw error;if(!(error instanceof OfflineHttpError))throw error;next={state:error.status===409?'conflict':'rejected',code:error.code};}
  await updateVault(current=>({...current,queue:current.queue.map(entry=>entry.payload.operationId===item.payload.operationId?{...entry,...next} as QueueEntry:entry),lastSeenAt:Date.now()}));
 }
}
/** Single-flight cycle: verify the session identity, refresh the device portfolio and push the queue. Safe to call often. */
export function runEngine(account:EngineAccount|null|undefined){
 if(running)return running;
 running=(async()=>{
  try{
   const local=await openVault().catch(()=>null);publish({pending:local?pendingCount(local.data):0,lastSyncAt:local?.data.lastSyncAt??status.lastSyncAt});
   if(!navigator.onLine){publish({phase:'offline',message:''});return;}
   if(!account||!offlineEnabled(account)||!account.user.id||!account.tenant.id)return;
   publish({phase:'syncing',message:''});
   const who=await sessionIdentity();if(who.user.id!==account.user.id||who.tenant.id!==account.tenant.id)throw new OfflineHttpError(401,'IDENTITY_CHANGED');
   let data=await refresh(account);if(!data)return;
   if(data.queue.some(item=>item.state==='pending')){await flush(data);data=(await openVault())!.data;
    // A confirmed conflict means the server changed: refresh so an explicit new attempt uses current versions.
    if(data.queue.some(item=>item.state==='conflict'))data=(await refresh(account))??data;}
   const lastSyncAt=new Date().toISOString();data=(await updateVault(current=>({...current,lastSyncAt,queue:[...current.queue.filter(item=>item.state!=='applied'&&item.state!=='superseded'),...current.queue.filter(item=>item.state==='applied').slice(-30)]}))).data;
   const attention=data.queue.filter(item=>item.state==='conflict'||item.state==='rejected').length;
   publish({phase:attention?'attention':'idle',pending:pendingCount(data),lastSyncAt,message:attention?attention+' registro(s) precisam de revisão em Operação offline.':''});
  }catch(error){
   if(offlineError(error))publish({phase:'offline',message:'Sem conexão com o servidor. Os registros continuam salvos no aparelho.'});
   else if(error instanceof OfflineHttpError&&[401,403].includes(error.status)){await blockVault().catch(()=>{});publish({phase:'attention',message:'Entre novamente com o mesmo usuário para sincronizar os registros do aparelho.'});}
   else publish({phase:'attention',message:error instanceof OfflineHttpError?'Sincronização recusada: '+error.code:(error as Error).message});
  }finally{running=null;announce();}
 })();
 return running;
}
/** Saves one operation on the device (always first), then tries to send it right away when online. */
export async function enqueue(payload:OfflinePayload,grantId?:string,account?:EngineAccount|null,changes?:(data:VaultData)=>VaultData){
 const saved=await updateVault(data=>{
  if(!leaseValid(data))throw Error('A autorização offline deste aparelho venceu. Conecte-se e entre novamente para continuar registrando.');
  const open=data.queue.filter(item=>!['applied','superseded'].includes(item.state));if(open.length>=100)throw Error('Há 100 registros aguardando envio. Conecte-se para sincronizar antes de registrar mais.');
  const next={...data,queue:[...data.queue,{payload,state:'pending',grantId:grantId??data.snapshot.grantId,queuedAt:new Date().toISOString()} as QueueEntry],lastSeenAt:Date.now()};
  return changes?changes(next):next;
 });
 publish({pending:pendingCount(saved.data)});
 if(navigator.onLine&&account)void runEngine(account);
 return saved.data;
}
