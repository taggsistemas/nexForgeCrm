import {Router} from 'express';
import {ZodError} from 'zod';
import type {IdentityService} from '../identity/service.js';
import {authorizeCompany,type AuthorizedCompany} from '../../infrastructure/authorization.js';
import {AccessDenied} from '../../infrastructure/access.js';
import {InvalidReference,RecordConflict,RecordNotFound} from '../relationships/service.js';
import {ticketActions} from '../../../../../packages/contracts/src/tickets.js';
import {TicketRuleRejected} from './input.js';
import {ticketService} from './service.js';
export function createTicketRouter(identity:IdentityService,origin:string){
 const router=Router({mergeParams:true});
 router.use((req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('origin')!==origin){res.status(403).json({code:'ORIGIN_REJECTED'});return;}next();});
 const args=(req:import('express').Request,res:import('express').Response)=>[(res.locals.authorizedCompany as AuthorizedCompany).context,String(req.params.companyId)] as const;
 router.get('/settings',authorizeCompany(identity,'ticket:read'),async(req,res)=>res.json(await ticketService.settings(...args(req,res))));
 router.put('/settings',authorizeCompany(identity,'list:manage'),async(req,res)=>res.json(await ticketService.saveSettings(...args(req,res),req.body)));
 router.get('/options',authorizeCompany(identity,'ticket:write'),async(req,res)=>res.json(await ticketService.options(...args(req,res),req.query)));
 router.get('/assignees',authorizeCompany(identity,'ticket:manage'),async(req,res)=>res.json(await ticketService.assignees(...args(req,res))));
 router.get('/',authorizeCompany(identity,'ticket:read'),async(req,res)=>res.json(await ticketService.list(...args(req,res),req.query)));
 router.post('/',authorizeCompany(identity,'ticket:write'),async(req,res)=>res.status(201).json(await ticketService.create(...args(req,res),req.body)));
 router.get('/:id',authorizeCompany(identity,'ticket:read'),async(req,res)=>res.json(await ticketService.detail(...args(req,res),String(req.params.id))));
 for(const action of ticketActions)router.post('/:id/'+action,authorizeCompany(identity,'ticket:manage'),async(req,res)=>res.json({record:await ticketService.act(...args(req,res),String(req.params.id),action,req.body)}));
 router.use((error:unknown,_req:unknown,res:import('express').Response,next:import('express').NextFunction)=>{
  if(error instanceof AccessDenied){res.status(403).json({code:'ACCESS_DENIED'});return;}
  if(error instanceof RecordNotFound){res.status(404).json({code:'NOT_FOUND'});return;}
  if(error instanceof RecordConflict){res.status(409).json({code:'RECORD_CONFLICT'});return;}
  if(error instanceof TicketRuleRejected){res.status(400).json({code:'TICKET_RULE_REJECTED',reason:error.code});return;}
  if(error instanceof InvalidReference){res.status(400).json({code:'INVALID_REFERENCE'});return;}
  if(error instanceof ZodError){res.status(400).json({code:'INVALID_INPUT'});return;}next(error);
 });
 return router;
}
