import {Schema,model} from 'mongoose';
const scope={tenantId:{type:Schema.Types.ObjectId,required:true,immutable:true},companyId:{type:Schema.Types.ObjectId,required:true,immutable:true}};
const position=new Schema({latitude:{type:Number,required:true},longitude:{type:Number,required:true},accuracy:{type:Number,required:true}},{_id:false,strict:'throw'});
const schema=new Schema({...scope,partyId:{type:Schema.Types.ObjectId,required:true,immutable:true},serviceId:{type:Schema.Types.ObjectId,required:true,immutable:true},technicianId:{type:Schema.Types.ObjectId,required:true,immutable:true},title:{type:String,required:true},startAt:{type:Date,required:true},endAt:{type:Date,required:true},notes:{type:String,default:''},state:{type:String,enum:['pending','in_progress','completed','cancelled','interrupted'],default:'pending'},version:{type:Number,default:0},checkedInAt:Date,checkedOutAt:Date,interruptedAt:Date,cancelledAt:Date,checkIn:position,checkOut:position,result:{type:String,default:''},reason:{type:String,default:''},locationNoticeVersion:{type:String,default:''},source:{type:String,enum:['manual'],default:'manual',immutable:true}},{timestamps:true,versionKey:false,strict:'throw'});
schema.index({tenantId:1,companyId:1,technicianId:1,startAt:1});
// Global executor lock across companies; the shared User.fieldRevision also serializes seller/offline attendance.
schema.index({technicianId:1},{unique:true,partialFilterExpression:{state:'in_progress'}});
export const TechnicalWork=model('CrmTechnicalWork',schema);
const audit=new Schema({...scope,workId:{type:Schema.Types.ObjectId,required:true},actorId:{type:Schema.Types.ObjectId,required:true},action:{type:String,required:true},reason:{type:String,default:''}},{timestamps:true,versionKey:false,strict:'throw'});
export const TechnicalAudit=model('CrmTechnicalAudit',audit);
export async function initializeTechnicalModels(){await Promise.all([TechnicalWork.init(),TechnicalAudit.init()]);}
