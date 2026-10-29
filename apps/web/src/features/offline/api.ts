import type {OfflineSnapshot,OfflinePayload} from '../../../../../packages/contracts/src/offline';
export class OfflineHttpError extends Error {constructor(public status:number,public code:string){super(code);}}
async function checked(response:Response){if(!response.ok){const data=await response.json().catch(()=>({}));throw new OfflineHttpError(response.status,data.code??'REQUEST_FAILED');}return response.json();}
export async function sessionIdentity(){return checked(await fetch('/api/v1/auth/session',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)}));}
export async function downloadSnapshot(company:string,ownerId:string){return checked(await fetch('/api/v1/companies/'+company+'/offline/prepare',{method:'POST',body:JSON.stringify(ownerId?{ownerId}:{}),headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)})) as Promise<OfflineSnapshot>;}
export async function syncOperation(company:string,grantId:string,operation:OfflinePayload){return checked(await fetch('/api/v1/companies/'+company+'/offline/sync',{method:'POST',body:JSON.stringify({grantId,operation}),headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)}));}

