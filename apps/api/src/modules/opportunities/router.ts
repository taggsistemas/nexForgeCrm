import {Router} from 'express';
import {ZodError} from 'zod';
import {authorizeCompany,type AuthorizedCompany} from '../../infrastructure/authorization.js';
import {AccessDenied} from '../../infrastructure/access.js';
import type {IdentityService} from '../identity/service.js';
import {RecordNotFound,RecordConflict} from '../relationships/service.js';
import {QualificationRequired} from '../relationships/qualification.js';
import {opportunityService,OpportunityRuleRejected} from './service.js';
export function createOpportunityRouter(identity:IdentityService,origin:string){
 const router=Router({mergeParams:true});
 router.use((req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('origin')!==origin){res.status(403).json({code:'ORIGIN_REJECTED'});return;}next();});
 const args=(req:import('express').Request,res:import('express').Response)=>[(res.locals.authorizedCompany as AuthorizedCompany).context,String(req.params.companyId)] as const;
 router.get('/references',authorizeCompany(identity,'pipeline:write'),async(req,res)=>res.json(await opportunityService.references(...args(req,res),req.query)));
 router.get('/',authorizeCompany(identity,'pipeline:read'),async(req,res)=>res.json(await opportunityService.list(...args(req,res),req.query)));
 router.post('/',authorizeCompany(identity,'pipeline:write'),async(req,res)=>res.status(201).json({record:await opportunityService.create(...args(req,res),req.body)}));
 router.get('/:id',authorizeCompany(identity,'pipeline:read'),async(req,res)=>res.json(await opportunityService.detail(...args(req,res),String(req.params.id))));
 router.patch('/:id',authorizeCompany(identity,'pipeline:write'),async(req,res)=>res.json({record:await opportunityService.update(...args(req,res),String(req.params.id),req.body)}));
 router.get('/:id/history',authorizeCompany(identity,'pipeline:read'),async(req,res)=>res.json(await opportunityService.history(...args(req,res),String(req.params.id),req.query)));
 router.get('/:id/activities',authorizeCompany(identity,'activity:read'),async(req,res)=>res.json(await opportunityService.activities(...args(req,res),String(req.params.id),req.query)));
 router.post('/:id/activities',authorizeCompany(identity,'activity:write'),async(req,res)=>res.status(201).json({record:await opportunityService.createActivity(...args(req,res),String(req.params.id),req.body)}));
 router.patch('/:id/activities/:activityId',authorizeCompany(identity,'activity:write'),async(req,res)=>res.json({record:await opportunityService.updateActivity(...args(req,res),String(req.params.id),String(req.params.activityId),req.body)}));
 router.use((error:unknown,_req:unknown,res:import('express').Response,next:import('express').NextFunction)=>{
  if(error instanceof AccessDenied){res.status(403).json({code:'ACCESS_DENIED'});return;}
  if(error instanceof RecordNotFound){res.status(404).json({code:'NOT_FOUND'});return;}
  if(error instanceof RecordConflict){res.status(409).json({code:'RECORD_CONFLICT'});return;}
  if(error instanceof OpportunityRuleRejected){res.status(400).json({code:'OPPORTUNITY_RULE_REJECTED'});return;}
  if(error instanceof QualificationRequired){res.status(400).json({code:'LEAD_QUALIFICATION_REQUIRED'});return;}
  if(error instanceof ZodError){res.status(400).json({code:'INVALID_INPUT'});return;}next(error);
 });
 return router;
}
