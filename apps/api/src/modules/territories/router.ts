import {Router} from 'express';
import {ZodError} from 'zod';
import type {IdentityService} from '../identity/service.js';
import {authorizeCompany,type AuthorizedCompany} from '../../infrastructure/authorization.js';
import {AccessDenied} from '../../infrastructure/access.js';
import {RecordNotFound,RecordConflict} from '../relationships/service.js';
import {AgendaRuleRejected} from '../agenda/recurrence.js';
import {TerritoryRuleRejected} from './errors.js';
import {territoryCatalog} from './catalog.js';
import {visitPlanning} from './planning.js';
export function createTerritoryRouter(identity:IdentityService,origin:string){
 const router=Router({mergeParams:true});
 router.use((req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('origin')!==origin){res.status(403).json({code:'ORIGIN_REJECTED'});return;}next();});
 const args=(req:import('express').Request,res:import('express').Response)=>[(res.locals.authorizedCompany as AuthorizedCompany).context,String(req.params.companyId)] as const;
 router.get('/options',authorizeCompany(identity,'company:read'),async(req,res)=>res.json(await territoryCatalog.options(...args(req,res),req.query)));
 router.get('/regions',authorizeCompany(identity,'region:read'),async(req,res)=>res.json(await territoryCatalog.regions(...args(req,res),req.query)));
 router.post('/regions',authorizeCompany(identity,'region:manage'),async(req,res)=>res.status(201).json({record:await territoryCatalog.saveRegion(...args(req,res),null,req.body)}));
 router.patch('/regions/:id',authorizeCompany(identity,'region:manage'),async(req,res)=>res.json({record:await territoryCatalog.saveRegion(...args(req,res),String(req.params.id),req.body)}));
 router.get('/portfolios',authorizeCompany(identity,'portfolio:read'),async(req,res)=>res.json(await territoryCatalog.portfolios(...args(req,res),req.query)));
 router.post('/portfolios',authorizeCompany(identity,'portfolio:manage'),async(req,res)=>res.status(201).json({record:await territoryCatalog.savePortfolio(...args(req,res),null,req.body)}));
 router.patch('/portfolios/:id',authorizeCompany(identity,'portfolio:manage'),async(req,res)=>res.json({record:await territoryCatalog.savePortfolio(...args(req,res),String(req.params.id),req.body)}));
 router.get('/parties',authorizeCompany(identity,'portfolio:read'),async(req,res)=>res.json(await territoryCatalog.parties(...args(req,res),req.query)));
 router.post('/assignments',authorizeCompany(identity,'portfolio:manage'),async(req,res)=>res.json(await territoryCatalog.transfer(...args(req,res),req.body)));
 router.get('/plans',authorizeCompany(identity,'visit:read'),async(req,res)=>res.json(await visitPlanning.list(...args(req,res),req.query)));
 router.post('/plans',authorizeCompany(identity,'visit:write'),async(req,res)=>res.status(201).json(await visitPlanning.create(...args(req,res),req.body)));
 router.get('/plans/:id',authorizeCompany(identity,'visit:read'),async(req,res)=>res.json(await visitPlanning.detail(...args(req,res),String(req.params.id),req.query)));
 router.patch('/plans/:id',authorizeCompany(identity,'visit:write'),async(req,res)=>res.json(await visitPlanning.update(...args(req,res),String(req.params.id),req.body)));
 router.post('/plans/:id/items',authorizeCompany(identity,'visit:write'),async(req,res)=>res.status(201).json(await visitPlanning.saveItem(...args(req,res),String(req.params.id),null,req.body)));
 router.patch('/plans/:id/items/:itemId',authorizeCompany(identity,'visit:write'),async(req,res)=>res.json(await visitPlanning.saveItem(...args(req,res),String(req.params.id),String(req.params.itemId),req.body)));
 router.post('/plans/:id/items/:itemId/remove',authorizeCompany(identity,'visit:write'),async(req,res)=>res.json(await visitPlanning.removeItem(...args(req,res),String(req.params.id),String(req.params.itemId),req.body)));
 for(const action of ['publish','cancel','complete'] as const)router.post('/plans/:id/'+action,authorizeCompany(identity,'visit:write'),async(req,res)=>res.json(await visitPlanning.action(...args(req,res),String(req.params.id),action,req.body)));
 router.use((error:unknown,_req:unknown,res:import('express').Response,next:import('express').NextFunction)=>{
  if(error instanceof AccessDenied){res.status(403).json({code:'ACCESS_DENIED'});return;}
  if(error instanceof RecordNotFound){res.status(404).json({code:'NOT_FOUND'});return;}
  if(error instanceof RecordConflict){res.status(409).json({code:'RECORD_CONFLICT'});return;}
  if(error instanceof TerritoryRuleRejected||error instanceof AgendaRuleRejected){res.status(400).json({code:'TERRITORY_RULE_REJECTED'});return;}
  if(error instanceof ZodError){res.status(400).json({code:'INVALID_INPUT'});return;}next(error);
 });return router;
}
