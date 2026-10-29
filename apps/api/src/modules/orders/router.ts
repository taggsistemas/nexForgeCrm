import {Router} from 'express';
import {ZodError} from 'zod';
import type {IdentityService} from '../identity/service.js';
import {authorizeCompany,type AuthorizedCompany} from '../../infrastructure/authorization.js';
import {AccessDenied} from '../../infrastructure/access.js';
import {RecordConflict,RecordNotFound} from '../relationships/service.js';
import {OrderRuleRejected} from './input.js';
import {orderService} from './service.js';
export function createOrderRouter(identity:IdentityService,origin:string){
 const router=Router({mergeParams:true});
 router.use((req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('origin')!==origin){res.status(403).json({code:'ORIGIN_REJECTED'});return;}next();});
 const args=(req:import('express').Request,res:import('express').Response)=>[(res.locals.authorizedCompany as AuthorizedCompany).context,String(req.params.companyId)] as const;
 router.get('/',authorizeCompany(identity,'order:read'),async(req,res)=>res.json(await orderService.list(...args(req,res),req.query)));
 router.post('/',authorizeCompany(identity,'order:write'),async(req,res)=>res.status(201).json(await orderService.createDirect(...args(req,res),req.body)));
 router.post('/from-proposal',authorizeCompany(identity,'order:write'),async(req,res)=>res.status(201).json(await orderService.createFromProposal(...args(req,res),req.body)));
 router.post('/from-work-order',authorizeCompany(identity,'order:write'),async(req,res)=>res.status(201).json(await orderService.createFromWorkOrder(...args(req,res),req.body)));
 router.get('/:id',authorizeCompany(identity,'order:read'),async(req,res)=>res.json(await orderService.detail(...args(req,res),String(req.params.id))));
 router.patch('/:id',authorizeCompany(identity,'order:write'),async(req,res)=>res.json({record:await orderService.update(...args(req,res),String(req.params.id),req.body)}));
 router.post('/:id/invoices',authorizeCompany(identity,'billing:write'),async(req,res)=>res.json({record:await orderService.registerInvoice(...args(req,res),String(req.params.id),req.body)}));
 for(const [action,permission] of [['submit','order:write'],['deliver','order:write'],['approve','order:approve'],['reject','order:approve'],['cancel','order:read']] as const)
  router.post('/:id/'+action,authorizeCompany(identity,permission),async(req,res)=>res.json({record:await orderService.act(...args(req,res),String(req.params.id),action,req.body)}));
 router.use((error:unknown,_req:unknown,res:import('express').Response,next:import('express').NextFunction)=>{
  if(error instanceof AccessDenied){res.status(403).json({code:'ACCESS_DENIED'});return;}
  if(error instanceof RecordNotFound){res.status(404).json({code:'NOT_FOUND'});return;}
  if(error instanceof RecordConflict){res.status(409).json({code:'RECORD_CONFLICT'});return;}
  if(error instanceof OrderRuleRejected){res.status(400).json({code:'ORDER_RULE_REJECTED',reason:error.code});return;}
  if(error instanceof ZodError){res.status(400).json({code:'INVALID_INPUT'});return;}next(error);
 });
 return router;
}
