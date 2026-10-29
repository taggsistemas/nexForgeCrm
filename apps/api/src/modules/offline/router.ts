import {Router} from 'express';
import {ZodError} from 'zod';
import type {IdentityService} from '../identity/service.js';
import {authorizeCompany,type AuthorizedCompany} from '../../infrastructure/authorization.js';
import {AccessDenied} from '../../infrastructure/access.js';
import {RecordNotFound} from '../relationships/service.js';
import {readSessionCookie} from '../identity/security.js';
import {OfflineConflict,OfflineRejected} from './input.js';
import {offlineService} from './service.js';
export function createOfflineRouter(identity:IdentityService,origin:string){
 const router=Router({mergeParams:true});router.use((req,res,next)=>{if(req.get('origin')!==origin){res.status(403).json({code:'ORIGIN_REJECTED'});return;}next();});
 const args=(req:import('express').Request,res:import('express').Response)=>[(res.locals.authorizedCompany as AuthorizedCompany).context,String(req.params.companyId)] as const;
 router.post('/prepare',authorizeCompany(identity,'activity:read'),async(req,res)=>res.json(await offlineService.prepare(...args(req,res),req.body,readSessionCookie(req.headers.cookie)??'')));
 router.post('/sync',authorizeCompany(identity,'activity:write'),async(req,res)=>res.json(await offlineService.sync(...args(req,res),req.body)));
 router.use((error:unknown,_req:unknown,res:import('express').Response,next:import('express').NextFunction)=>{
  if(error instanceof ZodError){res.status(400).json({code:'INVALID_INPUT'});return;}if(error instanceof AccessDenied){res.status(403).json({code:'ACCESS_DENIED'});return;}if(error instanceof RecordNotFound){res.status(404).json({code:'NOT_FOUND'});return;}if(error instanceof OfflineConflict){res.status(409).json({code:'OFFLINE_CONFLICT'});return;}if(error instanceof OfflineRejected){res.status(400).json({code:error.code});return;}next(error);
 });return router;
}
