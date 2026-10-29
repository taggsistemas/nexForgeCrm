import {Router} from 'express';
import {ZodError} from 'zod';
import type {IdentityService} from '../identity/service.js';
import {authorizeCompany,type AuthorizedCompany} from '../../infrastructure/authorization.js';
import {AccessDenied} from '../../infrastructure/access.js';
import {RecordNotFound,RecordConflict} from '../relationships/service.js';
import {FieldVisitRuleRejected} from './input.js';
import {fieldVisitService} from './service.js';
export function createFieldVisitRouter(identity:IdentityService,origin:string){
 const router=Router({mergeParams:true});
 router.use((req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('origin')!==origin){res.status(403).json({code:'ORIGIN_REJECTED'});return;}next();});
 const args=(req:import('express').Request,res:import('express').Response)=>[(res.locals.authorizedCompany as AuthorizedCompany).context,String(req.params.companyId)] as const;
 router.get('/daily',authorizeCompany(identity,'visit:read'),async(req,res)=>res.json(await fieldVisitService.daily(...args(req,res),req.query)));
 router.get('/activities/:id',authorizeCompany(identity,'visit:read'),async(req,res)=>res.json(await fieldVisitService.detail(...args(req,res),String(req.params.id))));
 router.post('/activities/:id/check-in',authorizeCompany(identity,'visit:write'),async(req,res)=>res.status(201).json(await fieldVisitService.checkIn(...args(req,res),String(req.params.id),req.body)));
 router.post('/activities/:id/check-out',authorizeCompany(identity,'visit:write'),async(req,res)=>res.json(await fieldVisitService.checkOut(...args(req,res),String(req.params.id),req.body)));
 router.post('/activities/:id/interrupt',authorizeCompany(identity,'visit:write'),async(req,res)=>res.json(await fieldVisitService.interrupt(...args(req,res),String(req.params.id),req.body)));
 router.use((error:unknown,_req:unknown,res:import('express').Response,next:import('express').NextFunction)=>{
  if(error instanceof AccessDenied){res.status(403).json({code:'ACCESS_DENIED'});return;}
  if(error instanceof RecordNotFound){res.status(404).json({code:'NOT_FOUND'});return;}
  if(error instanceof RecordConflict){res.status(409).json({code:'RECORD_CONFLICT'});return;}
  if(error instanceof FieldVisitRuleRejected){res.status(400).json({code:'FIELD_VISIT_RULE_REJECTED'});return;}
  if(error instanceof ZodError){res.status(400).json({code:'INVALID_INPUT'});return;}next(error);
 });return router;
}
