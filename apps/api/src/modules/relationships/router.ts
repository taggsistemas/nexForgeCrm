import {relationshipDashboard} from './dashboard.js';
import {qualificationWorkflow} from './qualification-workflow.js';
import {QualificationWorkflowRequired,QualificationSelfApproval} from './qualification-input.js';
import {PortfolioTransferRequired} from '../territories/errors.js';
import {QualificationRequired} from './qualification.js';
import {Router} from 'express';
import {ZodError} from 'zod';
import type {IdentityService} from '../identity/service.js';
import {authorizeCompany,type AuthorizedCompany} from '../../infrastructure/authorization.js';
import {AccessDenied} from '../../infrastructure/access.js';
import {relationshipService,RecordNotFound,RecordConflict,InvalidReference} from './service.js';
import type {PartyKind} from '../../../../../packages/contracts/src/relationships.js';
import type {Permission} from '../../../../../packages/contracts/src/index.js';
export function createRelationshipRouter(identity:IdentityService,origin:string){
 const router=Router({mergeParams:true});
 router.use((req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('origin')!==origin){res.status(403).json({code:'ORIGIN_REJECTED'});return;}next();});
 const scope=(res:import('express').Response)=>(res.locals.authorizedCompany as AuthorizedCompany).context;
 router.get('/dashboard',authorizeCompany(identity,'company:read'),async(req,res)=>res.json(await relationshipDashboard(scope(res),String(req.params.companyId),req.query)));
 for(const [path,kind,read,write] of [['leads','lead','lead:read','lead:write'],['customers','customer','customer:read','customer:write']] as const){
  router.get('/'+path,authorizeCompany(identity,read),async(req,res)=>res.json(await relationshipService.list(scope(res),String(req.params.companyId),kind,req.query)));
  router.post('/'+path,authorizeCompany(identity,write),async(req,res)=>res.status(201).json({record:await relationshipService.create(scope(res),String(req.params.companyId),kind,req.body)}));
  router.patch('/'+path+'/:id',authorizeCompany(identity,write),async(req,res)=>res.json({record:await relationshipService.update(scope(res),String(req.params.companyId),kind,String(req.params.id),req.body)}));
  router.post('/'+path+'/:id/archive',authorizeCompany(identity,write),async(req,res)=>res.json(await relationshipService.archive(scope(res),String(req.params.companyId),kind,String(req.params.id),req.body)));
 }
 router.post('/leads/:id/convert',authorizeCompany(identity,'lead:write'),async(req,res)=>res.json({record:await relationshipService.convert(scope(res),String(req.params.companyId),String(req.params.id),req.body)}));
 router.get('/parties/:id/qualification',authorizeCompany(identity,'qualification:read'),async(req,res)=>res.json(await qualificationWorkflow.detail(scope(res),String(req.params.companyId),String(req.params.id))));
 router.patch('/parties/:id/qualification',authorizeCompany(identity,'qualification:edit'),async(req,res)=>res.json(await qualificationWorkflow.save(scope(res),String(req.params.companyId),String(req.params.id),req.body)));
 router.post('/parties/:id/qualification/submit',authorizeCompany(identity,'qualification:submit'),async(req,res)=>res.json(await qualificationWorkflow.submit(scope(res),String(req.params.companyId),String(req.params.id),req.body)));
 router.post('/parties/:id/qualification/approve',authorizeCompany(identity,'qualification:approve'),async(req,res)=>res.json(await qualificationWorkflow.decide(scope(res),String(req.params.companyId),String(req.params.id),'approve',req.body)));
 router.post('/parties/:id/qualification/return',authorizeCompany(identity,'qualification:approve'),async(req,res)=>res.json(await qualificationWorkflow.decide(scope(res),String(req.params.companyId),String(req.params.id),'return',req.body)));
 router.get('/references',authorizeCompany(identity,'contact:read'),async(req,res)=>res.json(await relationshipService.references(scope(res),String(req.params.companyId),req.query)));
 router.get('/owners',authorizeCompany(identity,'company:read'),async(req,res)=>res.json(await relationshipService.owners(scope(res),String(req.params.companyId))));
 router.get('/parties/:partyId/contacts',authorizeCompany(identity,'contact:read'),async(req,res)=>res.json(await relationshipService.contacts(scope(res),String(req.params.companyId),String(req.params.partyId),req.query)));
 router.post('/parties/:partyId/contacts',authorizeCompany(identity,'contact:write'),async(req,res)=>res.status(201).json({record:await relationshipService.createContact(scope(res),String(req.params.companyId),String(req.params.partyId),req.body)}));
 router.patch('/parties/:partyId/contacts/:id',authorizeCompany(identity,'contact:write'),async(req,res)=>res.json({record:await relationshipService.updateContact(scope(res),String(req.params.companyId),String(req.params.partyId),String(req.params.id),req.body)}));
 router.post('/parties/:partyId/contacts/:id/archive',authorizeCompany(identity,'contact:write'),async(req,res)=>res.json({record:await relationshipService.updateContact(scope(res),String(req.params.companyId),String(req.params.partyId),String(req.params.id),req.body,true)}));
 router.use((error:unknown,_req:unknown,res:import('express').Response,next:import('express').NextFunction)=>{
  if(error instanceof QualificationSelfApproval){res.status(403).json({code:'SELF_APPROVAL_REJECTED'});return;}
  if(error instanceof QualificationWorkflowRequired){res.status(400).json({code:'QUALIFICATION_WORKFLOW_REQUIRED'});return;}
  if(error instanceof PortfolioTransferRequired){res.status(400).json({code:'PORTFOLIO_TRANSFER_REQUIRED'});return;}
  if(error instanceof QualificationRequired){res.status(400).json({code:'LEAD_QUALIFICATION_REQUIRED'});return;}
  if(error instanceof RecordNotFound){res.status(404).json({code:'NOT_FOUND'});return;}
  if(error instanceof RecordConflict){res.status(409).json({code:'RECORD_CONFLICT'});return;}
  if(error instanceof AccessDenied){res.status(403).json({code:'ACCESS_DENIED'});return;}
  if(error instanceof InvalidReference||error instanceof ZodError){res.status(400).json({code:'INVALID_INPUT'});return;}
  next(error);
 });
 return router;
}
