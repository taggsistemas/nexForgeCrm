import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import type {PortfolioView,RegionView} from '../../../../../packages/contracts/src/territories.js';
import {commercialFilter} from '../identity/profile-access.js';
import {User,Membership,Role} from '../identity/models.js';
import {Party,Contact,RelationshipAudit} from '../relationships/models.js';
import {RecordNotFound,RecordConflict} from '../relationships/service.js';
import {companyScope} from '../../infrastructure/access.js';
import {objectId} from '../relationships/input.js';
import {Region,Portfolio,VisitPlan} from './models.js';
import {createRegionInput,updateRegionInput,createPortfolioInput,updatePortfolioInput,transferInput,territoryListInput,optionInput} from './input.js';
import {scope,keyOf,literal,portfolio,party,partyFilter,seller,region,audit,transact} from './shared.js';
import {TerritoryRuleRejected} from './errors.js';
const regionView=(row:InstanceType<typeof Region>):RegionView=>({id:String(row._id),name:row.name,state:row.state,cities:row.cities,notes:row.notes,active:row.active,version:row.version});
async function portfolioView(row:InstanceType<typeof Portfolio>):Promise<PortfolioView>{
 const [owner,area]=await Promise.all([User.findById(row.ownerId).select('name'),row.regionId?Region.findOne({_id:row.regionId,tenantId:row.tenantId,companyId:row.companyId}):null]);
 return {id:String(row._id),name:row.name,ownerId:String(row.ownerId),ownerName:owner?.name??'Vendedor indisponível',regionId:row.regionId?String(row.regionId):null,regionName:area?.name??'',notes:row.notes,active:row.active,version:row.version};
}
export const territoryCatalog={
 async regions(context:AccessContext,companyId:string,raw:unknown){
  const input=territoryListInput.parse(raw),filter={...scope(context,companyId,'region:read'),...(input.search?{name:{$regex:literal(input.search),$options:'i'}}:{})};
  const [rows,total]=await Promise.all([Region.find(filter).sort({name:1,_id:1}).skip((input.page-1)*20).limit(20),Region.countDocuments(filter)]);
  return {items:rows.map(regionView),total,page:input.page,pageSize:20};
 },
 async saveRegion(context:AccessContext,companyId:string,id:string|null,raw:unknown){
  const company=scope(context,companyId,'region:manage'),input=id?updateRegionInput.parse(raw):createRegionInput.parse(raw);if(id)objectId.parse(id);
  return transact(async session=>{
   if(!id){const [row]=await Region.create([{...input,...company,nameKey:keyOf(input.name)}],{session});await audit(context,companyId,row._id,'region.created',session);return regionView(row);}
   const parsed=updateRegionInput.parse(raw),row=await Region.findOne({...company,_id:id}).session(session);if(!row)throw new RecordNotFound();if(row.version!==parsed.version)throw new RecordConflict();
   if(!parsed.active&&await Portfolio.exists({...company,regionId:id,active:true}).session(session))throw new TerritoryRuleRejected();
   const {version,...fields}=parsed;
   const updated=await Region.findOneAndUpdate({...company,_id:id,version},{$set:{...fields,nameKey:keyOf(fields.name)},$inc:{version:1}},{new:true,session,runValidators:true});if(!updated)throw new RecordConflict();
   await audit(context,companyId,id,'region.updated',session);return regionView(updated);
  });
 },
 async portfolios(context:AccessContext,companyId:string,raw:unknown){
  const input=territoryListInput.parse(raw),filter=commercialFilter(context,companyId,'portfolio:read',{...(input.search?{name:{$regex:literal(input.search),$options:'i'}}:{}),...(input.regionId?{regionId:input.regionId}:{})});
  const [rows,total]=await Promise.all([Portfolio.find(filter).sort({name:1,_id:1}).skip((input.page-1)*20).limit(20),Portfolio.countDocuments(filter)]);
  return {items:await Promise.all(rows.map(portfolioView)),total,page:input.page,pageSize:20};
 },
 async savePortfolio(context:AccessContext,companyId:string,id:string|null,raw:unknown){
  const company=scope(context,companyId,'portfolio:manage'),input=id?updatePortfolioInput.parse(raw):createPortfolioInput.parse(raw);
  return transact(async session=>{
   const existing=id?await portfolio(context,companyId,id,'portfolio:manage',session):null;
   if(!existing||!('active'in input)||input.active||String(existing.ownerId)!==input.ownerId)await seller(context,companyId,input.ownerId,session,true);
   await region(context,companyId,input.regionId,session);
   if(!id){const [row]=await Portfolio.create([{...input,...company,nameKey:keyOf(input.name)}],{session});await audit(context,companyId,row._id,'portfolio.created',session);return {id:String(row._id)};}
   const parsed=updatePortfolioInput.parse(raw),row=existing!;if(row.version!==parsed.version)throw new RecordConflict();
   if(!parsed.active||String(row.ownerId)!==parsed.ownerId){
    if(await Party.exists({...company,portfolioId:id,archived:false}).session(session)||await VisitPlan.exists({...company,portfolioId:id,state:{$in:['draft','published']}}).session(session))throw new TerritoryRuleRejected();
   }
   const {version,...fields}=parsed;
   const updated=await Portfolio.findOneAndUpdate({...company,_id:id,version},{$set:{...fields,nameKey:keyOf(fields.name)},$inc:{version:1}},{new:true,session,runValidators:true});if(!updated)throw new RecordConflict();
   await audit(context,companyId,id,'portfolio.updated',session);return {id};
  });
 },
 async parties(context:AccessContext,companyId:string,raw:unknown){
  const input=territoryListInput.parse(raw),filter=partyFilter(context,companyId,'portfolio:read',{...(input.search?{name:{$regex:literal(input.search),$options:'i'}}:{}),...(input.portfolioId?{portfolioId:input.portfolioId==='none'?null:input.portfolioId}:{})});
  const [rows,total]=await Promise.all([Party.find(filter).sort({name:1,_id:1}).skip((input.page-1)*20).limit(20),Party.countDocuments(filter)]);
  const items=await Promise.all(rows.map(async row=>{
   const [owner,book]=await Promise.all([User.findById(row.ownerId).select('name'),row.portfolioId?Portfolio.findOne({_id:row.portfolioId,tenantId:context.tenantId,companyId}):null]);
   const area=book?.regionId?await Region.findOne({_id:book.regionId,tenantId:context.tenantId,companyId}):null;
   return {id:String(row._id),name:row.name,kind:row.kind,ownerId:String(row.ownerId),ownerName:owner?.name??'Indisponível',portfolioId:row.portfolioId?String(row.portfolioId):null,portfolioName:book?.name??'',regionName:area?.name??'',version:row.version};
  }));return {items,total,page:input.page,pageSize:20};
 },
 async transfer(context:AccessContext,companyId:string,raw:unknown){
  const input=transferInput.parse(raw),company=scope(context,companyId,'portfolio:manage');
  return transact(async session=>{
   const target=input.portfolioId?await portfolio(context,companyId,input.portfolioId,'portfolio:manage',session,true):null;
   if(target){
    await seller(context,companyId,String(target.ownerId),session,true);await region(context,companyId,target.regionId?String(target.regionId):null,session);
    await Portfolio.updateOne({...company,_id:target._id},{$inc:{referenceRevision:1}},{session});
   }
   for(const entry of input.entries){
    const row=await party(context,companyId,entry.partyId,'portfolio:manage',session);companyScope(context,companyId,row.kind==='lead'?'lead:write':'customer:write');
    if(row.version!==entry.version)throw new RecordConflict();
    if(row.portfolioId)await Portfolio.updateOne({...company,_id:row.portfolioId},{$inc:{referenceRevision:1}},{session});
    const ownerId=target?String(target.ownerId):String(row.ownerId);
    const changed=await Party.updateOne({...company,_id:row._id,version:entry.version},{$set:{portfolioId:target?target._id:null,ownerId},$inc:{version:1}},{session,runValidators:true});if(changed.modifiedCount!==1)throw new RecordConflict();
    if(ownerId!==String(row.ownerId))await Contact.updateMany({...company,partyId:row._id},{$set:{ownerId},$inc:{version:1}},{session});
    await RelationshipAudit.create([{...company,actorId:context.userId,entityId:row._id,action:'party.updated'}],{session});
    await audit(context,companyId,row._id,'portfolio.assigned',session,{previousOwnerId:row.ownerId,nextOwnerId:ownerId});
   }
   return {count:input.entries.length};
  });
 },
 async options(context:AccessContext,companyId:string,raw:unknown){
  const input=optionInput.parse(raw),search=input.search?{$regex:literal(input.search),$options:'i'}:undefined;
  if(input.kind==='regions'){
   const rows=await Region.find({...scope(context,companyId,'region:read'),active:true,...(search?{name:search}:{})}).sort({name:1,_id:1}).limit(30);return {items:rows.map(row=>({id:String(row._id),name:row.name}))};
  }
  if(input.kind==='portfolios'){
   const rows=await Portfolio.find(commercialFilter(context,companyId,'portfolio:read',{active:true,...(search?{name:search}:{})})).sort({name:1,_id:1}).limit(30);return {items:await Promise.all(rows.map(async row=>({id:String(row._id),name:row.name+' — '+(await User.findById(row.ownerId).select('name'))?.name})))};
  }
  if(input.kind==='sellers'){
   scope(context,companyId,'portfolio:read');const roles=await Role.find({tenantId:context.tenantId,key:'seller'}).select('_id');
   const visibility=context.dataAccess!,visible=visibility.visibility==='company'?{}:{userId:{$in:visibility.visibility==='own'?[context.userId]:[context.userId,...visibility.supervisedUserIds]}};
   const members=await Membership.find({tenantId:context.tenantId,companyIds:companyId,active:true,roleIds:{$in:roles.map(row=>row._id)},...visible}).select('userId');
   const rows=await User.find({_id:{$in:members.map(row=>row.userId)},active:true,...(search?{name:search}:{})}).sort({name:1,_id:1}).limit(30);return {items:rows.map(row=>({id:String(row._id),name:row.name}))};
  }
  const rows=await Party.find(partyFilter(context,companyId,'visit:read',{...(input.portfolioId?{portfolioId:input.portfolioId}:{}),...(search?{name:search}:{})})).sort({name:1,_id:1}).limit(30);
  return {items:rows.map(row=>({id:String(row._id),name:row.name}))};
 }
};
