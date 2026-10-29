import {auditActorNames,auditActorLabel} from '../../infrastructure/audit-actors.js';
import mongoose from 'mongoose';
import type {AccessContext,Permission} from '../../../../../packages/contracts/src/index.js';
import {companyScope,AccessDenied} from '../../infrastructure/access.js';
import {commercialFilter} from '../identity/profile-access.js';
import {Party,QualificationSubmission,QualificationAudit,RelationshipAudit} from './models.js';
import {partyView,RecordNotFound,RecordConflict,assertTaxIdAvailable,criticalChanges,audit as relationshipAudit} from './service.js';
import {objectId,addressInput} from './input.js';
import {assertLeadQualified,QualificationRequired} from './qualification.js';
import {commercialInput,qualificationDraftInput,qualificationActionInput,qualificationReturnInput,QualificationWorkflowRequired,QualificationSelfApproval} from './qualification-input.js';
async function load(ctx:AccessContext,company:string,id:string,permission:Permission,session?:mongoose.ClientSession){
 objectId.parse(id);const kinds:string[]=[];if(ctx.permissions.includes('lead:read'))kinds.push('lead');if(ctx.permissions.includes('customer:read'))kinds.push('customer');
 const row=await Party.findOne(commercialFilter(ctx,company,permission,{_id:id,archived:false,kind:{$in:kinds}})).session(session??null);if(!row)throw new RecordNotFound();return row;
}
async function transact<T>(fn:(session:mongoose.ClientSession)=>Promise<T>){try{return await mongoose.connection.transaction(fn);}catch(error){if((error as {code?:number}).code===11000)throw new RecordConflict();throw error;}}
async function audit(ctx:AccessContext,company:string,id:unknown,action:string,session:mongoose.ClientSession,submissionId?:unknown,reason=''){await QualificationAudit.create([{...companyScope(ctx,company,'qualification:read'),partyId:id,actorId:ctx.userId,action,submissionId,reason}],{session});}
function assertComplete(row:InstanceType<typeof Party>){
 assertLeadQualified({...row.toObject(),stage:'qualificado'});
 if(!commercialInput.safeParse(row.toObject().commercial).success)throw new QualificationRequired();
 if(row.registrationStatus==='contribuinte'&&(!row.stateRegistration||row.stateRegistration==='ISENTO')||row.registrationStatus!=='contribuinte'&&row.stateRegistration&&!(row.registrationStatus==='isento'&&row.stateRegistration==='ISENTO'))throw new QualificationRequired();

}
export const qualificationWorkflow={
 async detail(ctx:AccessContext,company:string,id:string){
  const row=await load(ctx,company,id,'qualification:read'),filter={...companyScope(ctx,company,'qualification:read'),partyId:id};
  const [submission,history]=await Promise.all([QualificationSubmission.findOne({...filter,revision:row.qualificationRevision}),QualificationAudit.find(filter).sort({createdAt:-1,_id:-1}).limit(20)]);
  const actors=await auditActorNames(ctx.tenantId,history.map(event=>String(event.actorId)));
  return {record:partyView(row),submission:submission?{id:String(submission._id),revision:submission.revision,submittedBy:String(submission.submittedBy),submittedAt:submission.createdAt.toISOString(),snapshot:submission.snapshot,stale:submission.partyVersion!==row.version}:null,history:history.map(event=>({action:event.action,reason:event.reason,at:event.createdAt.toISOString(),actor:auditActorLabel(actors,String(event.actorId),ctx.userId)})),canApprove:ctx.permissions.includes('qualification:approve')&&row.qualificationState==='submitted'&&Boolean(submission)&&submission?.partyVersion===row.version&&submission?.submittedBy.toString()!==ctx.userId};
 },
 async save(ctx:AccessContext,company:string,id:string,raw:unknown){
  const input=qualificationDraftInput.parse(raw);return transact(async session=>{
   const row=await load(ctx,company,id,'qualification:edit',session);if(row.version!==input.version)throw new RecordConflict();if(['submitted','approved'].includes(row.qualificationState))throw new QualificationWorkflowRequired();
   const changes=Object.fromEntries(Object.entries(input).filter(([key])=>key!=='version'&&Object.hasOwn(raw as object,key)));
   if(input.address)changes.address=addressInput.parse({...row.toObject().address,...input.address});
   if(changes.registrationStatus==='isento')changes.stateRegistration='ISENTO';if(changes.registrationStatus==='nao_aplicavel')changes.stateRegistration='';
   if(!Boolean(changes.phone??row.phone)&&!Boolean(changes.email??row.email))throw new QualificationRequired();
   if(changes.taxId!==undefined&&changes.taxId!==row.taxId)await assertTaxIdAvailable(ctx,changes.taxId,row._id,session);const before=row.toObject();
   row.set({...changes,qualificationState:row.qualificationState==='revision'?'revision':'draft',version:row.version+1});await row.save({session});await audit(ctx,company,id,'draft_saved',session);
   const critical=criticalChanges(before,row.toObject());if(critical.length)await relationshipAudit(ctx,company,row._id,'party.updated',session,undefined,critical);return {record:partyView(row)};
  });
 },
 async submit(ctx:AccessContext,company:string,id:string,raw:unknown){
  const {version}=qualificationActionInput.parse(raw);companyScope(ctx,company,'qualification:submit');return transact(async session=>{
   const row=await load(ctx,company,id,'qualification:edit',session);if(row.version!==version)throw new RecordConflict();if(row.kind==='lead'&&row.stage==='descartado'||!['draft','revision'].includes(row.qualificationState))throw new QualificationWorkflowRequired();assertComplete(row);
   row.qualificationState='submitted';row.qualificationRevision++;row.reviewReason='';row.version++;await row.save({session});
   // Whitelist snapshot fields via the view; no caller-controlled document is persisted.
   const [submission]=await QualificationSubmission.create([{...companyScope(ctx,company,'qualification:submit'),partyId:id,revision:row.qualificationRevision,partyVersion:row.version,submittedBy:ctx.userId,snapshot:partyView(row)}],{session});await audit(ctx,company,id,'submitted',session,submission!._id);return {record:partyView(row)};
  });
 },
 async decide(ctx:AccessContext,company:string,id:string,action:'approve'|'return',raw:unknown){
  const input=action==='return'?qualificationReturnInput.parse(raw):qualificationActionInput.parse(raw);companyScope(ctx,company,'qualification:approve');
  return transact(async session=>{
   const row=await load(ctx,company,id,'qualification:approve',session);if(row.version!==input.version)throw new RecordConflict();if(row.qualificationState!=='submitted')throw new QualificationWorkflowRequired();
   const submission=await QualificationSubmission.findOne({...companyScope(ctx,company,'qualification:approve'),partyId:id,revision:row.qualificationRevision}).session(session);if(!submission)throw new QualificationWorkflowRequired();
   if(action==='approve'){
    if(String(submission.submittedBy)===ctx.userId)throw new QualificationSelfApproval();if(submission.partyVersion!==row.version)throw new RecordConflict();assertComplete(row);
    const converting=row.kind==='lead';row.kind='customer';row.stage='qualificado';row.qualificationState='approved';row.approvedAt=new Date();row.approvedBy=new mongoose.Types.ObjectId(ctx.userId);row.reviewReason='';
    await RelationshipAudit.create([{...companyScope(ctx,company,'qualification:approve'),entityId:id,actorId:ctx.userId,action:converting?'lead.converted':'customer.regularized'}],{session});
   }else{row.qualificationState='revision';row.reviewReason=qualificationReturnInput.parse(raw).reason;}
   row.version++;await row.save({session});await audit(ctx,company,id,action==='approve'?'approved':'returned',session,submission._id,row.reviewReason);return {record:partyView(row)};
  });
 }
};
