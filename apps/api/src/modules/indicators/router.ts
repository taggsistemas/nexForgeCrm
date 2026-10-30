import {Router} from 'express';
import {ZodError} from 'zod';
import type {IdentityService} from '../identity/service.js';
import {authorizeCompany,type AuthorizedCompany} from '../../infrastructure/authorization.js';
import {AccessDenied} from '../../infrastructure/access.js';
import {indicatorService} from './service.js';
import {indicatorDetails} from './details.js';
export function createIndicatorRouter(identity:IdentityService){
 const router=Router({mergeParams:true});
 router.get('/details',authorizeCompany(identity,'company:read'),async(req,res)=>res.json(await indicatorDetails((res.locals.authorizedCompany as AuthorizedCompany).context,String(req.params.companyId),req.query)));
 router.get('/',authorizeCompany(identity,'company:read'),async(req,res)=>res.json(await indicatorService.report((res.locals.authorizedCompany as AuthorizedCompany).context,String(req.params.companyId),req.query)));
 router.use((error:unknown,_req:unknown,res:import('express').Response,next:import('express').NextFunction)=>{
  if(error instanceof AccessDenied){res.status(403).json({code:'ACCESS_DENIED'});return;}
  if(error instanceof ZodError){res.status(400).json({code:'INVALID_INPUT'});return;}next(error);
 });
 return router;
}
