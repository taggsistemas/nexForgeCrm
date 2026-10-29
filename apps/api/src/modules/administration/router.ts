import {Router} from 'express';
import {ZodError} from 'zod';
import type {IdentityService} from '../identity/service.js';
import {readSessionCookie} from '../identity/security.js';
import {userIdInput} from './input.js';
import {administrationService,AdministrationConflict,AdministrationDenied,AdministrationInputError} from './service.js';
export function createAdministrationRouter(identity:IdentityService,origin:string){
  const router=Router();
  router.use(async(req,res,next)=>{
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('origin')!==origin){res.status(403).json({code:'ORIGIN_REJECTED'});return;}
    const token=readSessionCookie(req.headers.cookie),session=token?await identity.authenticate(token):null;
    if(!session){res.status(401).json({code:'AUTHENTICATION_REQUIRED'});return;}
    if(!session.context.permissions.includes('user:manage')){res.status(403).json({code:'ACCESS_DENIED'});return;}
    res.locals.tenantContext=session.context;next();
  });
  router.get('/users',async(_req,res)=>res.json(await administrationService.list(res.locals.tenantContext)));
  router.post('/users',async(req,res)=>res.status(201).json({user:await administrationService.create(res.locals.tenantContext,req.body)}));
  router.patch('/users/:id',async(req,res)=>{
    const id=userIdInput.safeParse(req.params.id);if(!id.success){res.status(400).json({code:'INVALID_INPUT'});return;}
    const user=await administrationService.update(res.locals.tenantContext,id.data,req.body);
    if(!user){res.status(404).json({code:'NOT_FOUND'});return;}res.json({user});
  });
  router.use((error:unknown,_req:unknown,res:import('express').Response,next:import('express').NextFunction)=>{
    if(error instanceof AdministrationDenied){res.status(403).json({code:'ACCESS_DENIED'});return;}
    if(error instanceof AdministrationConflict){res.status(409).json({code:'USER_CONFLICT'});return;}
    if(error instanceof ZodError||error instanceof AdministrationInputError){res.status(400).json({code:'INVALID_INPUT'});return;}
    next(error);
  });
  return router;
}
