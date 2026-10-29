import {Schema,model} from 'mongoose';
const options={timestamps:true,strict:'throw',versionKey:false} as const;
const reset=new Schema({_id:{type:Schema.Types.ObjectId,ref:'User'},tokenHash:{type:String,required:true,select:false},expiresAt:{type:Date,required:true},passwordVersion:{type:Number,required:true}},options);
reset.index({tokenHash:1},{unique:true});reset.index({expiresAt:1},{expireAfterSeconds:0});
export const PasswordReset=model('PasswordReset',reset);
const acceptance=new Schema({tenantId:{type:Schema.Types.ObjectId,required:true,immutable:true},userId:{type:Schema.Types.ObjectId,required:true,immutable:true},version:{type:String,required:true,immutable:true},documentHash:{type:String,required:true,immutable:true},acceptedAt:{type:Date,required:true,immutable:true}},options);
acceptance.index({tenantId:1,userId:1,version:1},{unique:true});
export const PrivacyAcceptance=model('PrivacyAcceptance',acceptance);
const audit=new Schema({tenantId:{type:Schema.Types.ObjectId},userId:{type:Schema.Types.ObjectId,required:true},action:{type:String,enum:['password.changed','password.reset','privacy.accepted'],required:true}},options);
audit.index({tenantId:1,userId:1,createdAt:-1});
export const AccountAudit=model('AccountAudit',audit);
export async function initializeAccountSecurityModels(){await Promise.all([PasswordReset.init(),PrivacyAcceptance.init(),AccountAudit.init(),RecoveryJob.init()]);}

const jobSchema=new Schema({_id:String,userId:{type:Schema.Types.ObjectId,default:null},requestId:{type:String,required:true},state:{type:String,enum:['pending','processing'],default:'pending'},attempts:{type:Number,default:0},nextAttemptAt:{type:Date,required:true},leaseUntil:Date,expiresAt:{type:Date,required:true}},options);
jobSchema.index({expiresAt:1},{expireAfterSeconds:0});jobSchema.index({state:1,nextAttemptAt:1});
export const RecoveryJob=model('RecoveryJob',jobSchema);
