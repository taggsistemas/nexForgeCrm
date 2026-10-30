import {Router,type Request,type Response,type NextFunction} from 'express';
import {ZodError} from 'zod';
import type {IdentityService} from '../identity/service.js';
import {authorizeCompany,type AuthorizedCompany} from '../../infrastructure/authorization.js';
import {AccessDenied} from '../../infrastructure/access.js';
import {RecordConflict,RecordNotFound} from '../relationships/service.js';
import {purchaseActions} from '../../../../../packages/contracts/src/supply.js';
import {SupplyRuleRejected} from './input.js';
import {stockService} from './stock.js';
import {companyProfileService,purchaseService,supplierService} from './service.js';
export function createSupplyRouter(identity:IdentityService,origin:string){
 const router=Router({mergeParams:true});
 router.use((req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('origin')!==origin){res.status(403).json({code:'ORIGIN_REJECTED'});return;}next();});
 const args=(req:Request,res:Response)=>[(res.locals.authorizedCompany as AuthorizedCompany).context,String(req.params.companyId)] as const;
 router.get('/company-profile',authorizeCompany(identity,'company:read'),async(req,res)=>res.json(await companyProfileService.get(...args(req,res))));
 router.put('/company-profile',authorizeCompany(identity,'company:manage'),async(req,res)=>res.json(await companyProfileService.save(...args(req,res),req.body)));
 router.get('/suppliers',authorizeCompany(identity,'supplier:read'),async(req,res)=>res.json(await supplierService.list(...args(req,res),req.query)));
 router.post('/suppliers',authorizeCompany(identity,'supplier:write'),async(req,res)=>res.status(201).json(await supplierService.create(...args(req,res),req.body)));
 router.patch('/suppliers/:id',authorizeCompany(identity,'supplier:write'),async(req,res)=>res.json(await supplierService.update(...args(req,res),String(req.params.id),req.body)));
 router.get('/stock',authorizeCompany(identity,'stock:read'),async(req,res)=>res.json(await stockService.balances(...args(req,res),req.query)));
 router.get('/stock/movements',authorizeCompany(identity,'stock:read'),async(req,res)=>res.json(await stockService.movements(...args(req,res),req.query)));
 router.post('/stock/movements',authorizeCompany(identity,'stock:write'),async(req,res)=>res.status(201).json(await stockService.manual(...args(req,res),req.body)));
 router.get('/purchases',authorizeCompany(identity,'purchase:read'),async(req,res)=>res.json(await purchaseService.list(...args(req,res),req.query)));
 router.post('/purchases',authorizeCompany(identity,'purchase:write'),async(req,res)=>res.status(201).json(await purchaseService.create(...args(req,res),req.body)));
 router.get('/purchases/:id',authorizeCompany(identity,'purchase:read'),async(req,res)=>res.json(await purchaseService.detail(...args(req,res),String(req.params.id))));
 router.patch('/purchases/:id',authorizeCompany(identity,'purchase:write'),async(req,res)=>res.json({record:await purchaseService.update(...args(req,res),String(req.params.id),req.body)}));
 router.post('/purchases/:id/receive',authorizeCompany(identity,'purchase:read'),async(req,res)=>res.json({record:await purchaseService.receive(...args(req,res),String(req.params.id),req.body)}));
 for(const action of purchaseActions)router.post('/purchases/:id/'+action,authorizeCompany(identity,action==='approve'||action==='reject'?'purchase:approve':'purchase:read'),async(req,res)=>res.json({record:await purchaseService.act(...args(req,res),String(req.params.id),action,req.body)}));
 router.use((error:unknown,_req:Request,res:Response,next:NextFunction)=>{
  if(error instanceof AccessDenied){res.status(403).json({code:'ACCESS_DENIED'});return;}
  if(error instanceof RecordNotFound){res.status(404).json({code:'NOT_FOUND'});return;}
  if(error instanceof RecordConflict){res.status(409).json({code:'RECORD_CONFLICT'});return;}
  if(error instanceof SupplyRuleRejected){res.status(400).json({code:'SUPPLY_RULE_REJECTED',reason:error.code});return;}
  if(error instanceof ZodError){res.status(400).json({code:'INVALID_INPUT',message:error.issues[0]?.message??''});return;}next(error);
 });
 return router;
}
