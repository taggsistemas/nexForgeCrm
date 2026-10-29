import {Schema,model} from 'mongoose';
import {customerTypes,leadStages} from '../../../../../packages/contracts/src/relationships.js';
const address=new Schema({postalCode:String,street:String,number:String,complement:String,neighborhood:String,city:String,state:String,country:String},{_id:false,versionKey:false,strict:'throw'});
const scope={tenantId:{type:Schema.Types.ObjectId,ref:'Tenant',required:true,immutable:true},companyId:{type:Schema.Types.ObjectId,ref:'Company',required:true,immutable:true},ownerId:{type:Schema.Types.ObjectId,ref:'User',required:true},archived:{type:Boolean,default:false},version:{type:Number,default:0,required:true}};
const options={timestamps:true,strict:'throw',versionKey:false} as const;
const partySchema=new Schema({...scope,portfolioId:{type:Schema.Types.ObjectId,default:null},kind:{type:String,enum:['lead','customer'],required:true},name:{type:String,required:true,maxlength:160},contactName:{type:String,default:'',maxlength:120},legalName:{type:String,default:'',maxlength:160},taxId:{type:String,default:'',maxlength:14},stateRegistration:{type:String,default:'',maxlength:20},email:{type:String,default:'',maxlength:254},phone:{type:String,default:'',maxlength:11},customerType:{type:String,enum:[...customerTypes],default:'outro'},stage:{type:String,enum:[...leadStages],default:'novo'},address:{type:address,required:true},notes:{type:String,default:'',maxlength:3000},commercialRevision:{type:Number,default:0},contactRevision:{type:Number,default:0}},options);
partySchema.index({tenantId:1,companyId:1,kind:1,archived:1,ownerId:1,createdAt:-1});
partySchema.index({tenantId:1,companyId:1,kind:1,archived:1,stage:1,ownerId:1,createdAt:-1});
partySchema.index({tenantId:1,companyId:1,taxId:1},{unique:true,partialFilterExpression:{taxId:{$gt:''},archived:false}});
partySchema.index({tenantId:1,companyId:1,portfolioId:1,archived:1,ownerId:1});
export const Party=model('CrmParty',partySchema);
const contactSchema=new Schema({...scope,partyId:{type:Schema.Types.ObjectId,ref:'CrmParty',required:true,immutable:true},name:{type:String,required:true,maxlength:120},email:{type:String,default:'',maxlength:254},phone:{type:String,default:'',maxlength:11},position:{type:String,default:'',maxlength:120},notes:{type:String,default:'',maxlength:3000}},options);
contactSchema.index({tenantId:1,companyId:1,partyId:1,archived:1,ownerId:1,createdAt:-1});
export const Contact=model('CrmContact',contactSchema);
const auditSchema=new Schema({previousStage:{type:String,enum:[...leadStages]},nextStage:{type:String,enum:[...leadStages]},tenantId:{type:Schema.Types.ObjectId,required:true},companyId:{type:Schema.Types.ObjectId,required:true},actorId:{type:Schema.Types.ObjectId,required:true},entityId:{type:Schema.Types.ObjectId,required:true},action:{type:String,enum:['lead.created','customer.created','party.updated','party.archived','lead.converted','lead.stage_changed','contact.created','contact.updated','contact.archived'],required:true}},options);
auditSchema.index({tenantId:1,companyId:1,createdAt:-1});
export const RelationshipAudit=model('RelationshipAudit',auditSchema);
export async function initializeRelationshipModels(){await Promise.all([Party.init(),Contact.init(),RelationshipAudit.init()]);}
