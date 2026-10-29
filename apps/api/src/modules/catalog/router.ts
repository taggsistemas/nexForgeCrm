import {Router} from 'express';
import {ZodError} from 'zod';
import type {IdentityService} from '../identity/service.js';
import {authorizeCompany,type AuthorizedCompany} from '../../infrastructure/authorization.js';
import {AccessDenied} from '../../infrastructure/access.js';
import {RecordNotFound,RecordConflict} from '../relationships/service.js';
import {CatalogRuleRejected} from './input.js';
import {catalogService} from './service.js';
export function createCatalogRouter(identity:IdentityService,origin:string){const router=Router({mergeParams:true});router.use((req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('origin')!==origin){res.status(403).json({code:'ORIGIN_REJECTED'});return;}next();});const args=(req:import('express').Request,res:import('express').Response)=>[(res.locals.authorizedCompany as AuthorizedCompany).context,String(req.params.companyId)] as const;
 router.get('/products',authorizeCompany(identity,'catalog:read'),async(req,res)=>res.json(await catalogService.products(...args(req,res),req.query)));
 router.get('/products/:id',authorizeCompany(identity,'catalog:read'),async(req,res)=>res.json(await catalogService.product(...args(req,res),String(req.params.id))));
 router.get('/tables',authorizeCompany(identity,'catalog:manage'),async(req,res)=>res.json(await catalogService.tables(...args(req,res),req.query)));
 router.get('/targets',authorizeCompany(identity,'catalog:manage'),async(req,res)=>res.json(await catalogService.targets(...args(req,res),req.query)));
 router.get('/resolve',authorizeCompany(identity,'catalog:read'),async(req,res)=>res.json(await catalogService.resolve(...args(req,res),req.query)));
 for(const [path,save] of [['products',catalogService.saveProduct],['tables',catalogService.saveTable]] as const){router.post('/'+path,authorizeCompany(identity,'catalog:manage'),async(req,res)=>res.status(201).json(await save(...args(req,res),null,req.body)));router.patch('/'+path+'/:id',authorizeCompany(identity,'catalog:manage'),async(req,res)=>res.json(await save(...args(req,res),String(req.params.id),req.body)));}
 router.use((error:unknown,_req:unknown,res:import('express').Response,next:import('express').NextFunction)=>{if(error instanceof ZodError){res.status(400).json({code:'INVALID_INPUT'});return;}if(error instanceof AccessDenied){res.status(403).json({code:'ACCESS_DENIED'});return;}if(error instanceof RecordNotFound){res.status(404).json({code:'NOT_FOUND'});return;}if(error instanceof RecordConflict){res.status(409).json({code:'RECORD_CONFLICT'});return;}if(error instanceof CatalogRuleRejected){res.status(400).json({code:error.code});return;}next(error);});return router;}
