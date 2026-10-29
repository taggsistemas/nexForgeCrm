import {Schema,model} from 'mongoose';
import {activityTypes,activityStatuses} from '../../../../../packages/contracts/src/opportunities.js';
import {agendaTimeZones,recurrenceFrequencies} from '../../../../../packages/contracts/src/agenda.js';
const scope={tenantId:{type:Schema.Types.ObjectId,required:true,immutable:true},companyId:{type:Schema.Types.ObjectId,required:true,immutable:true}};
const options={timestamps:true,versionKey:false,strict:'throw'} as const;
const activitySchema=new Schema({...scope,offlineCapturedAt:{type:Date,immutable:true},offlineOperationId:{type:String,immutable:true},fieldState:{type:String,enum:['none','in_progress','completed','interrupted','completed_offline'],default:'none'},visitPlanId:{type:Schema.Types.ObjectId,immutable:true},visitPlanItemId:{type:Schema.Types.ObjectId,immutable:true},durationMinutes:{type:Number,min:15,max:480},partyId:{type:Schema.Types.ObjectId,required:true,immutable:true},propertyId:{type:Schema.Types.ObjectId,default:null},equipmentId:{type:Schema.Types.ObjectId,default:null},objective:{type:String,default:'',maxlength:500},result:{type:String,default:'',maxlength:2000},nextAction:{type:String,default:'',maxlength:500},title:{type:String,required:true,maxlength:160},type:{type:String,enum:[...activityTypes],required:true},status:{type:String,enum:[...activityStatuses],default:'pendente'},dueAt:{type:Date,required:true},completedAt:{type:Date,default:null},notes:{type:String,default:'',maxlength:3000},seriesId:{type:Schema.Types.ObjectId,immutable:true},occurrenceIndex:{type:Number,immutable:true},version:{type:Number,default:0,required:true}},options);
activitySchema.index({tenantId:1,companyId:1,dueAt:1});
activitySchema.index({tenantId:1,companyId:1,partyId:1,dueAt:-1});
activitySchema.index({tenantId:1,companyId:1,seriesId:1,status:1,dueAt:1});
activitySchema.index({tenantId:1,companyId:1,visitPlanItemId:1},{unique:true,partialFilterExpression:{visitPlanItemId:{$type:'objectId'}}});
export const AgendaActivity=model('CrmAgendaActivity',activitySchema);
const seriesSchema=new Schema({...scope,partyId:{type:Schema.Types.ObjectId,required:true,immutable:true},opportunityId:{type:Schema.Types.ObjectId,immutable:true},frequency:{type:String,enum:recurrenceFrequencies.filter(value=>value!=='none'),required:true,immutable:true},interval:{type:Number,required:true,immutable:true},count:{type:Number,required:true,immutable:true},timeZone:{type:String,enum:[...agendaTimeZones],required:true,immutable:true},startAt:{type:Date,required:true,immutable:true},state:{type:String,enum:['active','cancelled'],default:'active'},cancelledAt:{type:Date,default:null},version:{type:Number,default:0}},options);
seriesSchema.index({tenantId:1,companyId:1,partyId:1});
export const AgendaSeries=model('CrmAgendaSeries',seriesSchema);
const auditSchema=new Schema({...scope,actorId:{type:Schema.Types.ObjectId,required:true},entityId:{type:Schema.Types.ObjectId,required:true},source:{type:String,enum:['party','opportunity','series'],required:true},action:{type:String,enum:['agenda.activity.created','agenda.activity.updated','agenda.series.created','agenda.series.cancelled'],required:true},affectedCount:{type:Number}},options);
auditSchema.index({tenantId:1,companyId:1,createdAt:-1});
export const AgendaAudit=model('CrmAgendaAudit',auditSchema);
export async function initializeAgendaModels(){await Promise.all([AgendaActivity.init(),AgendaSeries.init(),AgendaAudit.init()]);}

