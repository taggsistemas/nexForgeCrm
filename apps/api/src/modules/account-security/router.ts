import {Router} from 'express';
import {ZodError} from 'zod';
import {tokenHash,readSessionCookie} from '../identity/security.js';
import type {IdentityService} from '../identity/service.js';
import type {RecoveryMailer} from './mail.js';
import {accountSecurityService,CredentialChangeRejected,ResetTokenRejected} from './service.js';
import {privacyPolicy} from '../../../../../packages/contracts/src/privacy.js';
import {forgotPasswordInput} from './input.js';
export function createAccountSecurityRouter(identity:IdentityService,origin:string,mailer?:RecoveryMailer,privacyContact?:string){
 const router=Router(),attempts=new Map<string,{count:number;until:number}>();
 router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 router.get('/privacy-policy',(_req,res)=>res.json({...privacyPolicy,contact:privacyContact??''}));
 router.use((req,res,next)=>{
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('origin')!==origin){res.status(403).json({code:'ORIGIN_REJECTED'});return;}next();
 });
 router.use((req,res,next)=>{
  if(req.method==='POST'&&['/password/forgot','/password/reset','/password/change'].includes(req.path)){
   const now=Date.now();for(const [key,value]of attempts)if(value.until<=now)attempts.delete(key);
   const keys=['ip:'+req.ip+':'+req.path];
   if(req.path==='/password/forgot'){
    const parsed=forgotPasswordInput.safeParse(req.body);if(parsed.success)keys.push('account:'+tokenHash(parsed.data.email));
   }
   for(const key of keys){
    const previous=attempts.get(key),limit=key.startsWith('account:')?3:10;
    if((previous?.count??0)>=limit||(!previous&&attempts.size>=10000)){res.set('Retry-After','900').status(429).json({code:'TOO_MANY_ATTEMPTS'});return;}
   }
   for(const key of keys){const old=attempts.get(key);attempts.set(key,{count:(old?.count??0)+1,until:old?.until??now+900000});}
  }next();
 });
 router.post('/password/forgot',async(req,res)=>{
  forgotPasswordInput.parse(req.body);
  if(!mailer){res.status(503).json({code:'RECOVERY_UNAVAILABLE'});return;}
  await accountSecurityService.forgot(req.body);
  res.status(202).json({message:'Se houver uma conta ativa, as instruções serão enviadas ao e-mail cadastrado.'});
 });
 router.post('/password/reset',async(req,res)=>{await accountSecurityService.reset(req.body);res.status(204).end();});
 router.use(async(req,res,next)=>{
  const token=readSessionCookie(req.headers.cookie),verified=token?await identity.authenticate(token):null;
  if(!verified){res.status(401).json({code:'AUTHENTICATION_REQUIRED'});return;}
  res.locals.accountContext=verified.context;next();
 });
 router.post('/password/change',async(req,res)=>{
  await accountSecurityService.changePassword(res.locals.accountContext,req.body);
  res.clearCookie('nf_session',{httpOnly:true,secure:new URL(origin).protocol==='https:',sameSite:'strict',path:'/api/v1'}).status(204).end();
 });
 router.post('/privacy/accept',async(req,res)=>{await accountSecurityService.acceptPrivacy(res.locals.accountContext,req.body);res.status(204).end();});
 router.use((error:unknown,_req:unknown,res:import('express').Response,next:import('express').NextFunction)=>{
  if(error instanceof CredentialChangeRejected){res.status(400).json({code:'PASSWORD_CHANGE_REJECTED'});return;}
  if(error instanceof ResetTokenRejected){res.status(400).json({code:'RESET_TOKEN_INVALID'});return;}
  if(error instanceof ZodError){res.status(400).json({code:'INVALID_INPUT'});return;}next(error);
 });
 return router;
}
