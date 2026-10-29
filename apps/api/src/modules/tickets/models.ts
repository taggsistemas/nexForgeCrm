import {Schema,model} from 'mongoose';
import {ticketCriticalities,ticketOrigins,ticketStatuses} from '../../../../../packages/contracts/src/tickets.js';
const scope={tenantId:{type:Schema.Types.ObjectId,required:true,immutable:true},companyId:{type:Schema.Types.ObjectId,required:true,immutable:true}};
const options={timestamps:true,versionKey:false,strict:'throw'} as const;
// Every instant is stamped by the server; agreedDeadline is the only time typed by a person.
const ticketSchema=new Schema({...scope,number:{type:String,required:true,immutable:true},partyId:{type:Schema.Types.ObjectId,required:true,immutable:true},propertyId:{type:Schema.Types.ObjectId,required:true},equipmentId:{type:Schema.Types.ObjectId,default:null},origin:{type:String,enum:[...ticketOrigins],required:true},criticality:{type:String,enum:[...ticketCriticalities],required:true},title:{type:String,required:true,maxlength:160},description:{type:String,required:true,maxlength:3000},status:{type:String,enum:[...ticketStatuses],default:'aberto'},assigneeId:{type:Schema.Types.ObjectId,default:null},escalationLevel:{type:Number,default:0,min:0,max:20},previousTicketId:{type:Schema.Types.ObjectId,default:null,immutable:true},openedBy:{type:Schema.Types.ObjectId,required:true,immutable:true},openedAt:{type:Date,required:true,immutable:true},firstResponseAt:{type:Date,default:null},agreedDeadline:{type:Date,default:null},resolvedAt:{type:Date,default:null},cancelledAt:{type:Date,default:null},solution:{type:String,default:'',maxlength:3000},cancelReason:{type:String,default:'',maxlength:1000},version:{type:Number,default:0}},options);
ticketSchema.index({tenantId:1,companyId:1,number:1},{unique:true});
ticketSchema.index({tenantId:1,companyId:1,status:1,criticality:1,openedAt:1});
ticketSchema.index({tenantId:1,companyId:1,partyId:1,status:1});
ticketSchema.index({tenantId:1,companyId:1,equipmentId:1,openedAt:-1});
ticketSchema.index({tenantId:1,companyId:1,assigneeId:1,status:1});
export const Ticket=model('CrmTicket',ticketSchema);
const eventSchema=new Schema({...scope,ticketId:{type:Schema.Types.ObjectId,required:true,immutable:true},actorId:{type:Schema.Types.ObjectId,required:true,immutable:true},action:{type:String,enum:['opened','first_response','assigned','deadline_set','escalated','status_changed','resolved','cancelled'],required:true,immutable:true},note:{type:String,default:'',maxlength:3000,immutable:true},fromAssigneeId:{type:Schema.Types.ObjectId,default:null,immutable:true},toAssigneeId:{type:Schema.Types.ObjectId,default:null,immutable:true},statusAfter:{type:String,enum:[...ticketStatuses],required:true,immutable:true}},options);
eventSchema.index({tenantId:1,companyId:1,ticketId:1,createdAt:1});
export const TicketEvent=model('CrmTicketEvent',eventSchema);
const settingSchema=new Schema({...scope,criticalities:{type:[new Schema({key:{type:String,enum:[...ticketCriticalities],required:true},label:{type:String,required:true,maxlength:40}},{_id:false,strict:'throw',versionKey:false})],default:[]},version:{type:Number,default:0}},options);
settingSchema.index({tenantId:1,companyId:1},{unique:true});
export const TicketSetting=model('CrmTicketSetting',settingSchema);
const sequenceSchema=new Schema({...scope,value:{type:Number,default:0}},options);sequenceSchema.index({tenantId:1,companyId:1},{unique:true});
export const TicketSequence=model('CrmTicketSequence',sequenceSchema);
export async function initializeTicketModels(){await Promise.all([Ticket.init(),TicketEvent.init(),TicketSetting.init(),TicketSequence.init()]);}
