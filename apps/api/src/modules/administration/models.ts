import {Schema,model} from 'mongoose';
const schema=new Schema({
  tenantId:{type:Schema.Types.ObjectId,required:true,ref:'Tenant'},
  actorId:{type:Schema.Types.ObjectId,required:true,ref:'User'},
  targetId:{type:Schema.Types.ObjectId,required:true,ref:'User'},
  action:{type:String,enum:['user.created','user.updated'],required:true},
  profileKey:{type:String,required:true},active:{type:Boolean,required:true},
},{timestamps:true,strict:'throw'});
schema.index({tenantId:1,createdAt:-1});
export const AdministrationAudit=model('AdministrationAudit',schema);
