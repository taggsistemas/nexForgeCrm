import {Schema,model} from 'mongoose';
import {purchaseStatuses,stockSources} from '../../../../../packages/contracts/src/supply.js';
const scope={tenantId:{type:Schema.Types.ObjectId,required:true,immutable:true},companyId:{type:Schema.Types.ObjectId,required:true,immutable:true}};
const options={timestamps:true,versionKey:false,strict:'throw'} as const;
const address=new Schema({street:{type:String,default:''},number:{type:String,default:''},complement:{type:String,default:''},district:{type:String,default:''},city:{type:String,default:''},state:{type:String,default:''},zip:{type:String,default:''}},{_id:false,versionKey:false,strict:'throw'});
// Company data printed on sales orders, purchase orders and work orders. One document per company.
const profileSchema=new Schema({...scope,legalName:{type:String,default:''},tradeName:{type:String,default:''},taxId:{type:String,default:''},stateRegistration:{type:String,default:''},municipalRegistration:{type:String,default:''},address:{type:address,default:()=>({})},
 phone:{type:String,default:''},email:{type:String,default:''},website:{type:String,default:''},logo:{type:String,default:null,maxlength:420000},documentNotes:{type:String,default:'',maxlength:1000},purchaseApprovalLimitCents:{type:Number,default:0,min:0,max:1e13},version:{type:Number,default:0}},options);
profileSchema.index({tenantId:1,companyId:1},{unique:true});
export const CompanyProfile=model('CrmCompanyProfile',profileSchema);
const supplierSchema=new Schema({...scope,name:{type:String,required:true,maxlength:160},nameKey:{type:String,required:true},tradeName:{type:String,default:'',maxlength:160},taxId:{type:String,default:''},stateRegistration:{type:String,default:''},contactName:{type:String,default:''},phone:{type:String,default:''},email:{type:String,default:''},
 address:{type:address,default:()=>({})},paymentTerms:{type:String,default:'',maxlength:300},notes:{type:String,default:'',maxlength:2000},active:{type:Boolean,default:true},version:{type:Number,default:0}},options);
supplierSchema.index({tenantId:1,companyId:1,taxId:1},{unique:true,partialFilterExpression:{taxId:{$gt:''}}});
supplierSchema.index({tenantId:1,companyId:1,nameKey:1});
export const Supplier=model('CrmSupplier',supplierSchema);
// One warehouse per company: a balance per stocked product, serialized by its version.
const balanceSchema=new Schema({...scope,productId:{type:Schema.Types.ObjectId,required:true,immutable:true},quantityMilli:{type:Number,default:0},version:{type:Number,default:0}},options);
balanceSchema.index({tenantId:1,companyId:1,productId:1},{unique:true});
export const StockBalance=model('CrmStockBalance',balanceSchema);
// Immutable ledger. Automatic movements carry a unique source key so a retry never moves stock twice.
const movementSchema=new Schema({...scope,productId:{type:Schema.Types.ObjectId,required:true,immutable:true},direction:{type:String,enum:['entrada','saida'],required:true,immutable:true},source:{type:String,enum:[...stockSources],required:true,immutable:true},sourceKey:{type:String,default:null,immutable:true},
 reason:{type:String,default:'',immutable:true},quantityMilli:{type:Number,required:true,min:1,immutable:true},balanceAfterMilli:{type:Number,required:true,immutable:true},unitCostCents:{type:Number,default:null,immutable:true},negativeAlert:{type:Boolean,default:false,immutable:true},
 reference:{type:String,default:'',immutable:true},referenceId:{type:Schema.Types.ObjectId,default:null,immutable:true},note:{type:String,default:'',maxlength:1000,immutable:true},actorId:{type:Schema.Types.ObjectId,required:true,immutable:true}},options);
movementSchema.index({tenantId:1,companyId:1,sourceKey:1},{unique:true,partialFilterExpression:{sourceKey:{$type:'string'}}});
movementSchema.index({tenantId:1,companyId:1,productId:1,createdAt:-1});
movementSchema.index({tenantId:1,companyId:1,createdAt:-1});
export const StockMovement=model('CrmStockMovement',movementSchema);
const purchaseItem=new Schema({productId:{type:Schema.Types.ObjectId,required:true},code:{type:String,required:true},description:{type:String,required:true},kind:{type:String,enum:['product','service'],required:true},unit:{type:String,required:true},quantityDecimals:{type:Number,required:true},
 quantity:{type:String,required:true},unitCostCents:{type:Number,required:true,min:0},totalCents:{type:Number,required:true,min:0},receivedMilli:{type:Number,default:0,min:0}},{_id:false,versionKey:false,strict:'throw'});
const purchaseSchema=new Schema({...scope,number:{type:String,required:true,immutable:true},supplierId:{type:Schema.Types.ObjectId,required:true},status:{type:String,enum:[...purchaseStatuses],default:'rascunho'},items:{type:[purchaseItem],default:[]},totalCents:{type:Number,default:0,min:0,max:1e13},
 expectedDate:{type:String,required:true},paymentTerms:{type:String,default:'',maxlength:300},notes:{type:String,default:'',maxlength:3000},decisionNote:{type:String,default:'',maxlength:1000},needsApproval:{type:Boolean,default:false},
 createdBy:{type:Schema.Types.ObjectId,required:true,immutable:true},submittedBy:{type:Schema.Types.ObjectId,default:null},submittedAt:{type:Date,default:null},approvedBy:{type:Schema.Types.ObjectId,default:null},approvedAt:{type:Date,default:null},sentAt:{type:Date,default:null},receivedAt:{type:Date,default:null},cancelledAt:{type:Date,default:null},version:{type:Number,default:0}},options);
purchaseSchema.index({tenantId:1,companyId:1,number:1},{unique:true});
purchaseSchema.index({tenantId:1,companyId:1,status:1,createdAt:-1});
export const PurchaseOrder=model('CrmPurchaseOrder',purchaseSchema);
const purchaseEvent=new Schema({...scope,purchaseId:{type:Schema.Types.ObjectId,required:true,immutable:true},actorId:{type:Schema.Types.ObjectId,required:true,immutable:true},action:{type:String,required:true,immutable:true},note:{type:String,default:'',maxlength:1000,immutable:true}},options);
purchaseEvent.index({tenantId:1,companyId:1,purchaseId:1,createdAt:1});
export const PurchaseEvent=model('CrmPurchaseEvent',purchaseEvent);
const sequence=new Schema({...scope,value:{type:Number,default:0}},options);sequence.index({tenantId:1,companyId:1},{unique:true});
export const PurchaseSequence=model('CrmPurchaseSequence',sequence);
const auditSchema=new Schema({...scope,actorId:{type:Schema.Types.ObjectId,required:true,immutable:true},action:{type:String,required:true,immutable:true},entityId:{type:Schema.Types.ObjectId,required:true,immutable:true},note:{type:String,default:'',immutable:true}},options);
auditSchema.index({tenantId:1,companyId:1,createdAt:-1});
export const SupplyAudit=model('CrmSupplyAudit',auditSchema);
export async function initializeSupplyModels(){await Promise.all([CompanyProfile.init(),Supplier.init(),StockBalance.init(),StockMovement.init(),PurchaseOrder.init(),PurchaseEvent.init(),PurchaseSequence.init(),SupplyAudit.init()]);}
