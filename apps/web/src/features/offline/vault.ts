import type {OfflineSnapshot,OfflineQueueItem} from '../../../../../packages/contracts/src/offline';
import type {VisitPosition} from '../../../../../packages/contracts/src/field-visits';
export interface OfflineDraftVisit {activityId?:string;activityVersion?:number;partyId:string;partyVersion:number;grantId:string;observedInAt:string;checkIn:VisitPosition}
export type QueueEntry=OfflineQueueItem&{grantId:string;queuedAt?:string};
export interface VaultData {version:2;snapshot:OfflineSnapshot;queue:QueueEntry[];draftVisit:OfflineDraftVisit|null;lastSyncAt:string|null;lastSeenAt:number}
/** Envelope metadata is minimal: owner tag (hash of tenant/user, no names), counters and the encrypted payload. */
export interface Envelope {version:2;ownerTag:string;iv:string;ciphertext:string;revision:number;pendingCount:number;blocked:boolean}
export interface OpenVault {data:VaultData;key:CryptoKey;envelope:Envelope}
/**
 * One encrypted IndexedDB vault per device, opened automatically for its owner: the AES-GCM key is generated on the device,
 * non-extractable, and stored only as a CryptoKey in IndexedDB (never in localStorage, never as raw bytes).
 * There is no local password: anyone using this unlocked device profile can read the vault, so devices must be protected.
 */
const dbName='nexforge-crm-offline-v2',legacyName='nexforge-crm-offline-v1',aad=new TextEncoder().encode('nexforge-crm-offline-v2');
const channel=typeof window!=='undefined'&&'BroadcastChannel'in window?new BroadcastChannel('nf-offline-control'):null;
if(channel)channel.onmessage=()=>window.dispatchEvent(new Event('nf-offline-changed'));
export function announce(){window.dispatchEvent(new Event('nf-offline-changed'));channel?.postMessage('changed');}
const encode=(bytes:Uint8Array)=>{let result='';for(const byte of bytes)result+=String.fromCharCode(byte);return btoa(result);};
const decode=(value:string)=>Uint8Array.from(atob(value),char=>char.charCodeAt(0));
function request<T>(req:IDBRequest<T>){return new Promise<T>((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=event=>{event.preventDefault();reject(Error('Armazenamento local indisponível.'));};});}
/** IndexedDB exists only in a real origin; error events are handled here so they never surface as unhandled page errors. */
const storageAvailable=()=>typeof indexedDB!=='undefined'&&typeof location!=='undefined'&&location.origin!=='null';
async function database(){if(!storageAvailable())throw Error('Armazenamento local indisponível.');return new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(dbName,1);req.onupgradeneeded=()=>{req.result.createObjectStore('vault');req.result.createObjectStore('keys');};req.onerror=event=>{event.preventDefault();reject(Error('Armazenamento local indisponível.'));};req.onsuccess=()=>resolve(req.result);});}
export async function ownerTag(tenantId:string,userId:string){if(!globalThis.crypto?.subtle)throw Error('Use HTTPS (ou localhost) para habilitar o modo offline.');const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('nexforge-offline:'+tenantId+':'+userId));return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
export async function readEnvelope():Promise<Envelope|null>{const db=await database();try{return (await request(db.transaction('vault','readonly').objectStore('vault').get('primary')) as Envelope|undefined)??null;}finally{db.close();}}
async function readKey(tag:string):Promise<CryptoKey|null>{const db=await database();try{return (await request(db.transaction('keys','readonly').objectStore('keys').get(tag)) as CryptoKey|undefined)??null;}finally{db.close();}}
/** Device key of the owner: created once, non-extractable, usable only for encrypt/decrypt in this browser profile. */
async function deviceKey(tag:string){const existing=await readKey(tag);if(existing)return existing;const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);const db=await database();try{const tx=db.transaction('keys','readwrite');tx.objectStore('keys').put(key,tag);await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(Error('Não foi possível proteger os dados no aparelho.'));});}finally{db.close();}return key;}
/** Compare-and-swap on the envelope revision so two tabs never overwrite each other silently. */
async function writeEnvelope(value:Envelope|null,expected:number|null){const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['vault','keys'],'readwrite'),store=tx.objectStore('vault'),req=store.get('primary');let reason='Não foi possível gravar no aparelho.';req.onsuccess=()=>{const old=req.result as Envelope|undefined;if((old?.revision??null)!==expected){reason='STALE';tx.abort();return;}if(value)store.put(value,'primary');else{store.delete('primary');tx.objectStore('keys').clear();}};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(Error(reason));tx.onabort=()=>reject(Error(reason));});}finally{db.close();}announce();}
const pending=(data:VaultData)=>data.queue.filter(item=>item.state==='pending'||item.state==='conflict'||item.state==='rejected').length+(data.draftVisit?1:0);
export async function saveVault(data:VaultData,key:CryptoKey,tag:string,old:Envelope|null,blocked=false){
 const iv=crypto.getRandomValues(new Uint8Array(12)),ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,new TextEncoder().encode(JSON.stringify(data)));
 const value:Envelope={version:2,ownerTag:tag,iv:encode(iv),ciphertext:encode(new Uint8Array(ciphertext)),revision:(old?.revision??0)+1,pendingCount:pending(data),blocked};await writeEnvelope(value,old?.revision??null);return value;
}
export async function createVault(data:VaultData,tag:string,old:Envelope|null){const key=await deviceKey(tag);const envelope=await saveVault(data,key,tag,old);return {data,key,envelope} as OpenVault;}
/** Opens the device vault without any password; returns null when there is none or its key is missing. */
export async function openVault():Promise<OpenVault|null>{
 const envelope=await readEnvelope();if(!envelope||envelope.version!==2||envelope.ciphertext.length>12*1024*1024)return null;
 const key=await readKey(envelope.ownerTag);if(!key)return null;
 try{const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(envelope.iv),additionalData:aad},key,decode(envelope.ciphertext)),data=JSON.parse(new TextDecoder().decode(plain)) as VaultData;
  if(data.version!==2||!data.snapshot?.identity?.userId||!Array.isArray(data.queue)||data.queue.length>200)throw Error();return {data,key,envelope};}
 catch{throw Error('Os dados offline deste aparelho estão corrompidos. Apague-os em Operação offline.');}
}
/** Read-modify-write with retry when another tab changed the vault in between. */
export async function updateVault(change:(data:VaultData)=>VaultData|Promise<VaultData>,attempts=3):Promise<OpenVault>{
 for(let attempt=0;;attempt++){
  const current=await openVault();if(!current)throw Error('Os dados offline ainda não foram preparados neste aparelho. Conecte-se uma vez para habilitar.');
  try{const data=await change(current.data),envelope=await saveVault(data,current.key,current.envelope.ownerTag,current.envelope,current.envelope.blocked);return {data,key:current.key,envelope};}
  catch(error){const message=(error as Error).message;if(message!=='STALE'||attempt>=attempts-1)throw message==='STALE'?Error('Os dados mudaram em outra aba. Tente novamente.'):error;}
 }
}
export async function clearVault(){const old=await readEnvelope();if(old)await writeEnvelope(null,old.revision);}
/** Session ended or changed: keep the data but stop synchronizing until the same user is verified online again. */
export async function blockVault(){const old=await readEnvelope();if(old&&!old.blocked)await writeEnvelope({...old,blocked:true,revision:old.revision+1},old.revision);}
export async function unblockVault(){const old=await readEnvelope();if(old?.blocked)await writeEnvelope({...old,blocked:false,revision:old.revision+1},old.revision);}
export async function prepareOfflineLogout(){let old:Envelope|null;try{old=await readEnvelope();}catch{return true;}if(old?.pendingCount&&!window.confirm('Existem '+old.pendingCount+' registro(s) offline ainda não sincronizado(s). Sair apagará esses registros deste aparelho. Deseja continuar?'))return false;await clearVault();return true;}
/** Captures are accepted only inside the server lease (session and trial bounds) and with a coherent device clock. */
export function leaseValid(data:VaultData){return Date.now()>=Date.parse(data.snapshot.issuedAt)-60000&&Date.now()>=data.lastSeenAt-60000&&Date.now()<Date.parse(data.snapshot.expiresAt);}
/** The password-protected vault of earlier versions cannot be opened anymore; drop it when it holds no pending record. */
export async function legacyPending():Promise<number>{
 if(!storageAvailable()||!('databases'in indexedDB))return 0;
 const names=(await indexedDB.databases()).map(item=>item.name);if(!names.includes(legacyName))return 0;
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(legacyName);req.onsuccess=()=>resolve(req.result);req.onerror=event=>{event.preventDefault();reject(Error('Armazenamento local indisponível.'));};});
 let count=0;try{if(db.objectStoreNames.contains('vault'))count=((await request(db.transaction('vault','readonly').objectStore('vault').get('primary')) as {pendingCount?:number}|undefined)?.pendingCount)??0;}finally{db.close();}
 if(!count)indexedDB.deleteDatabase(legacyName);return count;
}
