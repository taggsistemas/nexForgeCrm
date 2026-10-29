import {QualificationWorkflowRequired} from './qualification-input.js';
import {FieldExecution} from '../field-visits/models.js';
import {PortfolioTransferRequired} from '../territories/errors.js';
import {assertLeadQualified} from './qualification.js';
import {digits,normalizeTaxId} from '../../../../../packages/contracts/src/customer.js';
import mongoose from 'mongoose';
import type {AccessContext,Permission} from '../../../../../packages/contracts/src/index.js';
import type {PartyKind,PartyView,ContactView} from '../../../../../packages/contracts/src/relationships.js';
import {Party,Contact,RelationshipAudit} from './models.js';
import {User,Membership} from '../identity/models.js';
import {companyScope,AccessDenied} from '../../infrastructure/access.js';
import {commercialFilter} from '../identity/profile-access.js';
import {createPartyInput,createLeadInput,updateLeadInput,updatePartyInput,createContactInput,updateContactInput,versionInput,convertInput,listInput,objectId,addressInput} from './input.js';
export class RecordNotFound extends Error {}
export class RecordConflict extends Error {}
export class InvalidReference extends Error {}
const readPermission=(kind:PartyKind):Permission=>kind==='lead'?'lead:read':'customer:read';
const writePermission=(kind:PartyKind):Permission=>kind==='lead'?'lead:write':'customer:write';
const literal=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const searchTerm=(search:string,field:string)=>field==='phone'&&/^[0-9() .+/-]+$/.test(search)?digits(search):field==='taxId'&&/[0-9]/.test(search)?normalizeTaxId(search):search;
const searchFilter=(search:string)=>search?{$or:['name','contactName','email','phone','taxId'].map(field=>({[field]:{$regex:literal(searchTerm(search,field)||search),$options:'i'}}))}:{};
export function partyView(row:InstanceType<typeof Party>):PartyView {
 const address=row.address;
 return {qualification:{state:row.qualificationState,revision:row.qualificationRevision,reviewReason:row.reviewReason,approvedAt:row.approvedAt?.toISOString()??null,approvedBy:row.approvedBy?String(row.approvedBy):null,registrationStatus:row.registrationStatus,commercial:{creditLimitCents:row.commercial.creditLimitCents,paymentMethods:row.commercial.paymentMethods as import('../../../../../packages/contracts/src/qualification.js').CommercialConditions['paymentMethods'],paymentTermDays:row.commercial.paymentTermDays}},id:String(row._id),portfolioId:row.portfolioId?String(row.portfolioId):null,kind:row.kind as PartyKind,name:row.name,contactName:row.contactName??'',legalName:row.legalName,taxId:row.taxId,stateRegistration:row.stateRegistration,email:row.email,phone:row.phone,customerType:row.customerType,stage:row.stage,
 address:{postalCode:address.postalCode??'',street:address.street??'',number:address.number??'',complement:address.complement??'',neighborhood:address.neighborhood??'',city:address.city??'',state:address.state??'',country:address.country??'Brasil'},
 ownerId:String(row.ownerId),notes:row.notes,version:row.version,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()};
}
function contactView(row:InstanceType<typeof Contact>):ContactView{return {id:String(row._id),partyId:String(row.partyId),name:row.name,email:row.email,phone:row.phone,position:row.position,notes:row.notes,ownerId:String(row.ownerId),version:row.version,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()};}
async function audit(context:AccessContext,companyId:string,entityId:unknown,action:string,session:mongoose.ClientSession,transition?:{previousStage:string;nextStage:string}){
 await RelationshipAudit.create([{tenantId:context.tenantId,companyId,actorId:context.userId,entityId,action,...transition}],{session});
}
async function ownedUser(context:AccessContext,companyId:string,requested:string|undefined,session:mongoose.ClientSession){
 const id=requested??context.userId;
 if(!context.dataAccess)throw new AccessDenied();
 if(context.dataAccess.visibility!=='company'&&id!==context.userId&&!(context.dataAccess.visibility==='team'&&context.dataAccess.supervisedUserIds.includes(id)))throw new InvalidReference();
 const [member,user]=await Promise.all([Membership.findOne({tenantId:context.tenantId,userId:id,active:true,companyIds:companyId}).session(session),User.findOne({_id:id,active:true}).session(session)]);
 if(!member||!user)throw new InvalidReference();
 return id;
}
async function parent(context:AccessContext,companyId:string,partyId:string,permission:Permission,session?:mongoose.ClientSession){
 objectId.parse(partyId);
 const query=Party.findOne(commercialFilter(context,companyId,permission,{_id:partyId,archived:false}));
 if(session)query.session(session);
 const record=await query;
 if(!record||!context.permissions.includes(readPermission(record.kind as PartyKind)))throw new RecordNotFound();
 return record;
}
async function conflictOrMissing(context:AccessContext,companyId:string,kind:PartyKind,id:string,session:mongoose.ClientSession):Promise<never>{
 if(await Party.exists(commercialFilter(context,companyId,writePermission(kind),{_id:id,kind,archived:false})).session(session))throw new RecordConflict();
 throw new RecordNotFound();
}
async function transact<T>(operation:(session:mongoose.ClientSession)=>Promise<T>):Promise<T>{
 try{return await mongoose.connection.transaction(operation);}
 catch(error){if((error as {code?:number}).code===11000)throw new RecordConflict();throw error;}
}
export const relationshipService={
 async list(context:AccessContext,companyId:string,kind:PartyKind,raw:unknown){
  const input=listInput.parse(raw),filter=commercialFilter(context,companyId,readPermission(kind),{kind,archived:false,...searchFilter(input.search),...(kind==='lead'&&input.stage?{stage:input.stage}:{}),...(input.qualificationState?(input.qualificationState==='none'?{$and:[{$or:[{qualificationState:'none'},{qualificationState:{$exists:false}}]}]}:{qualificationState:input.qualificationState}):{})});
  const [rows,total]=await Promise.all([Party.find(filter).sort({createdAt:-1,_id:-1}).skip((input.page-1)*20).limit(20),Party.countDocuments(filter)]);
  return {items:rows.map(partyView),total,page:input.page,pageSize:20};
 },
 async create(context:AccessContext,companyId:string,kind:PartyKind,raw:unknown){
  if(kind==='customer')throw new QualificationWorkflowRequired();
  const input=createLeadInput.parse(raw),scope=companyScope(context,companyId,writePermission(kind));
  commercialFilter(context,companyId,writePermission(kind));

  return transact(async session=>{
   const ownerId=await ownedUser(context,companyId,input.ownerId,session);
   const [row]=await Party.create([{...input,...scope,ownerId,kind}],{session});
   await audit(context,companyId,row._id,kind+'.created',session);return partyView(row);
  });
 },
 async update(context:AccessContext,companyId:string,kind:PartyKind,id:string,raw:unknown){
  objectId.parse(id);const parsed=(kind==='lead'?updateLeadInput:updatePartyInput).parse(raw);const {version,ownerId:requestedOwner}=parsed;
  const input:Record<string,unknown>=Object.fromEntries(Object.entries(parsed).filter(([key])=>!['version','ownerId'].includes(key)&&Object.hasOwn(raw as object,key)));
  return transact(async session=>{
   const old=await Party.findOne(commercialFilter(context,companyId,writePermission(kind),{_id:id,kind,archived:false})).session(session);
   if(!old)throw new RecordNotFound();
   if(old.qualificationState==='submitted')throw new QualificationWorkflowRequired();
   if(kind==='customer'&&input.stage&&input.stage!==old.stage&&input.stage!=='qualificado')throw new QualificationWorkflowRequired();
   const ownerId=await ownedUser(context,companyId,requestedOwner??String(old.ownerId),session);
   if(old.portfolioId&&ownerId!==String(old.ownerId))throw new PortfolioTransferRequired();
   if(Object.hasOwn(input,'address'))input.address=addressInput.parse({...old.toObject().address,...input.address as Record<string,unknown>});
   if(kind==='lead'&&!Boolean(input.phone??old.phone)&&!Boolean(input.email??old.email))throw new QualificationWorkflowRequired();
   const row=await Party.findOneAndUpdate(commercialFilter(context,companyId,writePermission(kind),{_id:id,kind,archived:false,version}),{$set:{...input,ownerId},$inc:{version:1}},{new:true,session,runValidators:true});
   if(!row)return conflictOrMissing(context,companyId,kind,id,session);
   if(String(old.ownerId)!==ownerId)await Contact.updateMany({tenantId:context.tenantId,companyId,partyId:row._id},{$set:{ownerId},$inc:{version:1}},{session,runValidators:true});
   if(kind==='lead'&&old.stage!==row.stage)await audit(context,companyId,row._id,'lead.stage_changed',session,{previousStage:old.stage,nextStage:row.stage});
   await audit(context,companyId,row._id,'party.updated',session);return partyView(row);
  });
 },
 async archive(context:AccessContext,companyId:string,kind:PartyKind,id:string,raw:unknown){
  objectId.parse(id);const {version}=versionInput.parse(raw);
  return transact(async session=>{
   const row=await Party.findOneAndUpdate(commercialFilter(context,companyId,writePermission(kind),{_id:id,kind,archived:false,version}),{$set:{archived:true},$inc:{version:1}},{new:true,session});
   if(!row)return conflictOrMissing(context,companyId,kind,id,session);
   if(row.qualificationState==='submitted')throw new QualificationWorkflowRequired();
   if(await FieldExecution.exists({tenantId:context.tenantId,companyId,partyId:id,state:'in_progress'}).session(session))throw new RecordConflict();
   await Contact.updateMany({tenantId:context.tenantId,companyId,partyId:row._id},{$set:{archived:true},$inc:{version:1}},{session});
   await audit(context,companyId,row._id,'party.archived',session);return {id};
  });
 },
 async convert(_context:AccessContext,_companyId:string,_id:string,_raw:unknown):Promise<PartyView>{throw new QualificationWorkflowRequired();},
 async references(context:AccessContext,companyId:string,raw:unknown){
  const input=listInput.parse(raw),kinds:PartyKind[]=[];
  if(context.permissions.includes('lead:read'))kinds.push('lead');
  if(context.permissions.includes('customer:read'))kinds.push('customer');
  if(!kinds.length)throw new AccessDenied();
  const rows=await Party.find(commercialFilter(context,companyId,readPermission(kinds[0]!),{kind:{$in:kinds},archived:false,...searchFilter(input.search)})).sort({name:1,_id:1}).limit(30);
  return {items:rows.map(row=>({id:String(row._id),name:row.name,kind:row.kind}))};
 },
 async owners(context:AccessContext,companyId:string){
  const permission=context.permissions.find(value=>['lead:write','customer:write','contact:write'].includes(value));
  if(!permission||!context.dataAccess)throw new AccessDenied();
  commercialFilter(context,companyId,permission);
  const visible=context.dataAccess.visibility==='company'?{}:{userId:{$in:context.dataAccess.visibility==='own'?[context.userId]:[context.userId,...context.dataAccess.supervisedUserIds]}};
  const members=await Membership.find({tenantId:context.tenantId,companyIds:companyId,active:true,...visible}).limit(500);
  const users=await User.find({_id:{$in:members.map(row=>row.userId)},active:true}).select('name').sort({name:1});
  return {items:users.map(user=>({id:String(user._id),name:user.name}))};
 },
 async contacts(context:AccessContext,companyId:string,partyId:string,raw:unknown){
  await parent(context,companyId,partyId,'contact:read');
  const input=listInput.parse(raw),filter=commercialFilter(context,companyId,'contact:read',{partyId,archived:false,...(input.search?{$or:['name','email','phone'].map(field=>({[field]:{$regex:literal(searchTerm(input.search,field)||input.search),$options:'i'}}))}:{})});
  const [rows,total]=await Promise.all([Contact.find(filter).sort({createdAt:-1,_id:-1}).skip((input.page-1)*20).limit(20),Contact.countDocuments(filter)]);
  return {items:rows.map(contactView),total,page:input.page,pageSize:20};
 },
 async createContact(context:AccessContext,companyId:string,partyId:string,raw:unknown){
  const input=createContactInput.parse(raw);
  return transact(async session=>{
   const record=await parent(context,companyId,partyId,'contact:write',session);
   await Party.updateOne({_id:record._id,tenantId:context.tenantId,companyId,archived:false},{$inc:{contactRevision:1}},{session});
   const [row]=await Contact.create([{...input,tenantId:context.tenantId,companyId,partyId:record._id,ownerId:record.ownerId}],{session});
   await audit(context,companyId,row._id,'contact.created',session);return contactView(row);
  });
 },
 async updateContact(context:AccessContext,companyId:string,partyId:string,id:string,raw:unknown,archive=false){
  objectId.parse(id);const input=archive?versionInput.parse(raw):updateContactInput.parse(raw);
  return transact(async session=>{
   const record=await parent(context,companyId,partyId,'contact:write',session);
   await Party.updateOne({_id:record._id,tenantId:context.tenantId,companyId,archived:false},{$inc:{contactRevision:1}},{session});
   const {version}=input;const fields=Object.fromEntries(Object.entries(input).filter(([key])=>key!=='version'&&Object.hasOwn(raw as object,key)));
   const row=await Contact.findOneAndUpdate(commercialFilter(context,companyId,'contact:write',{_id:id,partyId,archived:false,version}),{$set:archive?{archived:true}:fields,$inc:{version:1}},{new:true,session,runValidators:true});
   if(!row){
    if(await Contact.exists(commercialFilter(context,companyId,'contact:write',{_id:id,partyId,archived:false})).session(session))throw new RecordConflict();
    throw new RecordNotFound();
   }
   await audit(context,companyId,row._id,archive?'contact.archived':'contact.updated',session);return contactView(row);
  });
 },
};
