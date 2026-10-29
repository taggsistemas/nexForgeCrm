import {Party} from './models.js';
const legacyIndex='tenantId_1_companyId_1_taxId_1',tenantIndex='tenant_tax_id_unique';
export interface TaxIdReview {duplicates:{tenantId:string;partyIds:string[]}[];applied:boolean}
/**
 * Lists active parties sharing a document inside the same tenant (group). Reports only IDs, never
 * documents or names. With apply, builds the tenant-wide index and drops the per-company one, only
 * when no duplicate remains; duplicates are resolved by people (archive or correct), never here.
 */
export async function reviewTaxIds(apply=false):Promise<TaxIdReview>{
 const groups=await Party.aggregate<{_id:{tenantId:unknown};partyIds:unknown[]}>([
  {$match:{taxId:{$gt:''},archived:false}},
  {$group:{_id:{tenantId:'$tenantId',taxId:'$taxId'},partyIds:{$push:'$_id'},count:{$sum:1}}},
  {$match:{count:{$gt:1}}},
  {$project:{_id:{tenantId:'$_id.tenantId'},partyIds:1}},
 ]);
 const duplicates=groups.map(group=>({tenantId:String(group._id.tenantId),partyIds:group.partyIds.map(String).sort()}));
 if(!apply||duplicates.length)return {duplicates,applied:false};
 await Party.collection.createIndex({tenantId:1,taxId:1},{unique:true,name:tenantIndex,partialFilterExpression:{taxId:{$gt:''},archived:false}});
 if((await Party.collection.indexes()).some(index=>index.name===legacyIndex))await Party.collection.dropIndex(legacyIndex);
 return {duplicates,applied:true};
}
