import {Router} from 'express';
import {ZodError} from 'zod';
import type {IdentityService} from '../identity/service.js';
import {authorizeCompany,type AuthorizedCompany} from '../../infrastructure/authorization.js';
import {AccessDenied} from '../../infrastructure/access.js';
import {RecordNotFound,RecordConflict} from '../relationships/service.js';
import {OpportunityRuleRejected} from '../opportunities/service.js';
import {sourceInput} from './input.js';
import {agendaService} from './service.js';
import {AgendaRuleRejected} from './recurrence.js';
export function createAgendaRouter(identity:IdentityService,origin:string){
 const router=Router({mergeParams:true});
 router.use((req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('origin')!==origin){res.status(403).json({code:'ORIGIN_REJECTED'});return;}next();});
 const args=(req:import('express').Request,res:import('express').Response)=>[(res.locals.authorizedCompany as AuthorizedCompany).context,String(req.params.companyId)] as const;
 router.get('/owners',authorizeCompany(identity,'activity:read'),async(req,res)=>res.json(await agendaService.owners(...args(req,res))));
 router.get('/references',authorizeCompany(identity,'activity:write'),async(req,res)=>res.json(await agendaService.references(...args(req,res),req.query)));
 router.get('/activities',authorizeCompany(identity,'activity:read'),async(req,res)=>res.json(await agendaService.list(...args(req,res),req.query)));
 router.post('/activities',authorizeCompany(identity,'activity:write'),async(req,res)=>res.status(201).json(await agendaService.create(...args(req,res),req.body)));
 router.get('/activities/:source/:id',authorizeCompany(identity,'activity:read'),async(req,res)=>res.json(await agendaService.detail(...args(req,res),sourceInput.parse(req.params.source),String(req.params.id))));
 router.patch('/activities/:source/:id',authorizeCompany(identity,'activity:write'),async(req,res)=>res.json(await agendaService.update(...args(req,res),sourceInput.parse(req.params.source),String(req.params.id),req.body)));
 router.post('/series/:id/cancel',authorizeCompany(identity,'activity:write'),async(req,res)=>res.json(await agendaService.cancelSeries(...args(req,res),String(req.params.id),req.body)));
 router.use((error:unknown,_req:unknown,res:import('express').Response,next:import('express').NextFunction)=>{
  if(error instanceof AccessDenied){res.status(403).json({code:'ACCESS_DENIED'});return;}
  if(error instanceof RecordNotFound){res.status(404).json({code:'NOT_FOUND'});return;}
  if(error instanceof RecordConflict){res.status(409).json({code:'RECORD_CONFLICT'});return;}
  if(error instanceof OpportunityRuleRejected||error instanceof AgendaRuleRejected){res.status(400).json({code:'AGENDA_RULE_REJECTED'});return;}
  if(error instanceof ZodError){res.status(400).json({code:'INVALID_INPUT'});return;}next(error);
 });
 return router;
}
