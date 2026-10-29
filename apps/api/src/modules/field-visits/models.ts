import {Schema,model} from 'mongoose';
import {visitOutcomes} from '../../../../../packages/contracts/src/field-visits.js';
const position=new Schema({latitude:{type:Number,required:true,min:-90,max:90},longitude:{type:Number,required:true,min:-180,max:180},accuracy:{type:Number,required:true,min:0,max:10000}},{_id:false,versionKey:false,strict:'throw'});
const scope={tenantId:{type:Schema.Types.ObjectId,required:true,immutable:true},companyId:{type:Schema.Types.ObjectId,required:true,immutable:true}};
const options={timestamps:true,versionKey:false,strict:'throw'} as const;
const execution=new Schema({...scope,locationNoticeVersion:{type:String,immutable:true},activityId:{type:Schema.Types.ObjectId,required:true,immutable:true},partyId:{type:Schema.Types.ObjectId,required:true,immutable:true},actorId:{type:Schema.Types.ObjectId,required:true,immutable:true},state:{type:String,enum:['in_progress','completed','interrupted'],required:true},checkedInAt:{type:Date,required:true,immutable:true},checkedOutAt:{type:Date,default:null},checkIn:{type:position,required:true,immutable:true},checkOut:{type:position,default:null},outcome:{type:String,enum:[...visitOutcomes],default:null},notes:{type:String,default:'',maxlength:3000},nextSteps:{type:String,default:'',maxlength:2000},interruptionReason:{type:String,default:'',maxlength:1000},version:{type:Number,default:0}},options);
execution.index({tenantId:1,companyId:1,activityId:1},{unique:true});
// Global person lock: no simultaneous visits, including across companies.
execution.index({actorId:1},{unique:true,partialFilterExpression:{state:'in_progress'}});
export const FieldExecution=model('CrmFieldExecution',execution);
const audit=new Schema({...scope,actorId:{type:Schema.Types.ObjectId,required:true},executionId:{type:Schema.Types.ObjectId,required:true},activityId:{type:Schema.Types.ObjectId,required:true},action:{type:String,enum:['visit.checkin','visit.checkout','visit.interrupted'],required:true}},options);
audit.index({tenantId:1,companyId:1,createdAt:-1});
export const FieldVisitAudit=model('CrmFieldVisitAudit',audit);
export async function initializeFieldVisitModels(){await Promise.all([FieldExecution.init(),FieldVisitAudit.init()]);}


