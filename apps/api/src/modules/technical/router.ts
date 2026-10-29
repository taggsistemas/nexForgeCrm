import {Router} from 'express';
import {ZodError} from 'zod';
import type {IdentityService} from '../identity/service.js';
import {authorizeCompany,type AuthorizedCompany} from '../../infrastructure/authorization.js';
import {AccessDenied} from '../../infrastructure/access.js';
import {RecordNotFound,RecordConflict} from '../relationships/service.js';
import {TechnicalRuleRejected} from './input.js';
import {AgendaRuleRejected} from '../agenda/recurrence.js';
import {technicalService} from './service.js';
export function createTechnicalRouter(identity:IdentityService,origin:string){const router=Router({mergeParams:true});router.use((req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('origin')!==origin){res.status(403).json({code:'ORIGIN_REJECTED'});return;}next();});const args=(req:import('express').Request,res:import('express').Response)=>[(res.locals.authorizedCompany as AuthorizedCompany).context,String(req.params.companyId)] as const;
 router.get('/',authorizeCompany(identity,'technical:read'),async(req,res)=>res.json(await technicalService.list(...args(req,res),req.query)));
 router.get('/:id/parts',authorizeCompany(identity,'technical:read'),async(req,res)=>res.json(await technicalService.parts(...args(req,res),String(req.params.id))));
 router.get('/:id/parts/options',authorizeCompany(identity,'technical:read'),async(req,res)=>res.json(await technicalService.partOptions(...args(req,res),String(req.params.id),req.query)));
 // Writers are checked in the service: assigned technician or coordination, until the work order is closed.
 router.post('/:id/parts',authorizeCompany(identity,'technical:read'),async(req,res)=>res.status(201).json(await technicalService.addPart(...args(req,res),String(req.params.id),req.body)));
 router.get('/orders',authorizeCompany(identity,'technical:read'),async(req,res)=>res.json(await technicalService.orders(...args(req,res),req.query)));
 router.get('/options',authorizeCompany(identity,'technical:manage'),async(req,res)=>res.json(await technicalService.options(...args(req,res),req.query)));
 router.post('/',authorizeCompany(identity,'technical:manage'),async(req,res)=>res.status(201).json(await technicalService.create(...args(req,res),req.body)));
 router.get('/:id',authorizeCompany(identity,'technical:read'),async(req,res)=>res.json(await technicalService.detail(...args(req,res),String(req.params.id))));
 for(const action of ['check-in','check-out','cancel','interrupt','close'] as const)router.post('/:id/'+action,authorizeCompany(identity,['cancel','interrupt','close'].includes(action)?'technical:manage':'technical:write'),async(req,res)=>res.json(await technicalService.act(...args(req,res),String(req.params.id),action,req.body)));
 router.use((error:unknown,_req:unknown,res:import('express').Response,next:import('express').NextFunction)=>{if(error instanceof ZodError){res.status(400).json({code:'INVALID_INPUT'});return;}if(error instanceof AccessDenied){res.status(403).json({code:'ACCESS_DENIED'});return;}if(error instanceof RecordNotFound){res.status(404).json({code:'NOT_FOUND'});return;}if(error instanceof RecordConflict){res.status(409).json({code:'RECORD_CONFLICT'});return;}if(error instanceof TechnicalRuleRejected||error instanceof AgendaRuleRejected){res.status(400).json({code:'TECHNICAL_RULE_REJECTED'});return;}next(error);});return router;}
