import {Schema,model} from 'mongoose';
import {orderApprovalReasons,orderKinds,orderOrigins,orderStatuses} from '../../../../../packages/contracts/src/orders.js';
const scope={tenantId:{type:Schema.Types.ObjectId,required:true,immutable:true},companyId:{type:Schema.Types.ObjectId,required:true,immutable:true}};
const options={timestamps:true,versionKey:false,strict:'throw'} as const;
// Lines freeze catalog code/description/unit, the table reference price and, at confirmation, the unit cost.
const item=new Schema({productId:{type:Schema.Types.ObjectId,required:true},code:{type:String,required:true},description:{type:String,required:true},kind:{type:String,enum:['product','service'],required:true},unit:{type:String,required:true},quantity:{type:String,required:true},unitPriceCents:{type:Number,required:true,min:0,max:1e12},discountCents:{type:Number,default:0,min:0,max:1e12},referencePriceCents:{type:Number,default:null},totalCents:{type:Number,required:true,min:0,max:1e12},costCents:{type:Number,default:null}},{_id:false,strict:'throw',versionKey:false});
const invoice=new Schema({number:{type:String,required:true,maxlength:40},issueDate:{type:String,required:true},amountCents:{type:Number,required:true,min:1,max:1e13},registeredBy:{type:Schema.Types.ObjectId,required:true},registeredAt:{type:Date,required:true}},{_id:false,strict:'throw',versionKey:false});
const orderSchema=new Schema({...scope,number:{type:String,required:true,immutable:true},kind:{type:String,enum:[...orderKinds],required:true,immutable:true},origin:{type:String,enum:[...orderOrigins],required:true,immutable:true},partyId:{type:Schema.Types.ObjectId,required:true,immutable:true},opportunityId:{type:Schema.Types.ObjectId,default:null,immutable:true},proposalId:{type:Schema.Types.ObjectId,default:null,immutable:true},workOrderId:{type:Schema.Types.ObjectId,default:null,immutable:true},
 status:{type:String,enum:[...orderStatuses],default:'rascunho'},items:{type:[item],default:[]},totalCents:{type:Number,default:0,min:0,max:1e13},paymentMethod:{type:String,default:''},paymentTermDays:{type:[Number],default:[]},expectedDeliveryDate:{type:String,required:true},notes:{type:String,default:'',maxlength:3000},
 approvalReasons:{type:[String],enum:[...orderApprovalReasons],default:[]},decisionNote:{type:String,default:'',maxlength:1000},createdBy:{type:Schema.Types.ObjectId,required:true,immutable:true},submittedBy:{type:Schema.Types.ObjectId,default:null},submittedAt:{type:Date,default:null},approvedBy:{type:Schema.Types.ObjectId,default:null},confirmedAt:{type:Date,default:null},deliveredAt:{type:Date,default:null},invoicedAt:{type:Date,default:null},cancelledAt:{type:Date,default:null},
 invoices:{type:[invoice],default:[]},invoicedCents:{type:Number,default:0,min:0},version:{type:Number,default:0}},options);
orderSchema.index({tenantId:1,companyId:1,number:1},{unique:true});
orderSchema.index({tenantId:1,companyId:1,partyId:1,status:1});
orderSchema.index({tenantId:1,companyId:1,status:1,expectedDeliveryDate:1});
// One order per accepted proposal and per closed work order.
orderSchema.index({tenantId:1,companyId:1,proposalId:1},{unique:true,partialFilterExpression:{proposalId:{$type:'objectId'}}});
orderSchema.index({tenantId:1,companyId:1,workOrderId:1},{unique:true,partialFilterExpression:{workOrderId:{$type:'objectId'}}});
export const SalesOrder=model('CrmSalesOrder',orderSchema);
const eventSchema=new Schema({...scope,orderId:{type:Schema.Types.ObjectId,required:true,immutable:true},actorId:{type:Schema.Types.ObjectId,required:true,immutable:true},action:{type:String,required:true,immutable:true},note:{type:String,default:'',maxlength:1000,immutable:true}},options);
eventSchema.index({tenantId:1,companyId:1,orderId:1,createdAt:1});
export const SalesOrderEvent=model('CrmSalesOrderEvent',eventSchema);
const sequence=new Schema({...scope,value:{type:Number,default:0}},options);sequence.index({tenantId:1,companyId:1},{unique:true});
export const SalesOrderSequence=model('CrmSalesOrderSequence',sequence);
export async function initializeOrderModels(){await Promise.all([SalesOrder.init(),SalesOrderEvent.init(),SalesOrderSequence.init()]);}
