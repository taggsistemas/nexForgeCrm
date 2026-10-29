import {Schema,model} from 'mongoose';
import {opportunityStages,activityTypes,activityStatuses} from '../../../../../packages/contracts/src/opportunities.js';
const scope={tenantId:{type:Schema.Types.ObjectId,required:true,immutable:true},companyId:{type:Schema.Types.ObjectId,required:true,immutable:true}};
const options={timestamps:true,versionKey:false,strict:'throw'} as const;
const opportunitySchema=new Schema({...scope,partyId:{type:Schema.Types.ObjectId,required:true,immutable:true},title:{type:String,required:true,maxlength:160},amountCents:{type:Number,required:true,min:1,max:1e12},currency:{type:String,enum:['BRL'],default:'BRL'},expectedCloseDate:{type:String,required:true},stage:{type:String,enum:[...opportunityStages],default:'descoberta'},lossReason:{type:String,default:'',maxlength:1000},notes:{type:String,default:'',maxlength:3000},activityRevision:{type:Number,default:0},closedAt:{type:Date,default:null},version:{type:Number,default:0,required:true}},options);
opportunitySchema.index({tenantId:1,companyId:1,stage:1,createdAt:-1});
opportunitySchema.index({tenantId:1,companyId:1,partyId:1});
export const Opportunity=model('CrmOpportunity',opportunitySchema);
const activitySchema=new Schema({...scope,seriesId:{type:Schema.Types.ObjectId,immutable:true},occurrenceIndex:{type:Number,immutable:true},opportunityId:{type:Schema.Types.ObjectId,required:true,immutable:true},title:{type:String,required:true,maxlength:160},type:{type:String,enum:[...activityTypes],required:true},status:{type:String,enum:[...activityStatuses],default:'pendente'},dueAt:{type:Date,required:true},completedAt:{type:Date,default:null},notes:{type:String,default:'',maxlength:3000},version:{type:Number,default:0,required:true}},options);
activitySchema.index({tenantId:1,companyId:1,opportunityId:1,dueAt:1});
activitySchema.index({tenantId:1,companyId:1,dueAt:1});
activitySchema.index({tenantId:1,companyId:1,seriesId:1,status:1,dueAt:1});
export const OpportunityActivity=model('CrmOpportunityActivity',activitySchema);
const historySchema=new Schema({...scope,opportunityId:{type:Schema.Types.ObjectId,required:true},actorId:{type:Schema.Types.ObjectId,required:true},action:{type:String,enum:['opportunity.created','opportunity.updated','opportunity.stage_changed','activity.created','activity.updated'],required:true},entityId:{type:Schema.Types.ObjectId,required:true},previousStage:{type:String,enum:[...opportunityStages]},nextStage:{type:String,enum:[...opportunityStages]}},options);
historySchema.index({tenantId:1,companyId:1,opportunityId:1,createdAt:-1});
export const OpportunityHistory=model('CrmOpportunityHistory',historySchema);
export async function initializeOpportunityModels(){await Promise.all([Opportunity.init(),OpportunityActivity.init(),OpportunityHistory.init()]);}
