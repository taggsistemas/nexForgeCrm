import {Schema,model} from 'mongoose';
const scope={tenantId:{type:Schema.Types.ObjectId,required:true,immutable:true},companyId:{type:Schema.Types.ObjectId,required:true,immutable:true}};
const options={timestamps:true,versionKey:false,strict:'throw'} as const;
const productSchema=new Schema({...scope,code:{type:String,required:true,immutable:true},manufacturerSku:String,description:{type:String,required:true},kind:{type:String,enum:['product','service'],required:true},unit:{type:String,required:true},quantityDecimals:{type:Number,required:true},packaging:{type:String,enum:['unit','homogeneous','mixed'],required:true},components:[{_id:false,productId:{type:Schema.Types.ObjectId,required:true},quantity:{type:String,required:true}}],variableWeight:{type:Boolean,required:true},estimatedWeightGrams:{type:Number,default:null},ncm:{type:String,default:''},cest:{type:String,default:''},deliveryDays:{type:Number,required:true},costCents:{type:Number,default:null,min:0,max:1e12},costVersion:{type:Number,default:0},active:{type:Boolean,default:true},version:{type:Number,default:0}},options);
productSchema.index({tenantId:1,companyId:1,code:1},{unique:true});
export const CatalogProduct=model('CrmCatalogProduct',productSchema);
const tableSchema=new Schema({...scope,validFrom:{type:String,default:null},validUntil:{type:String,default:null},name:{type:String,required:true},scope:{type:String,required:true},targetId:{type:String,default:''},targetName:{type:String,default:''},active:{type:Boolean,default:true},entries:[{_id:false,productId:{type:Schema.Types.ObjectId,required:true},priceCents:{type:Number,required:true}}],version:{type:Number,default:0}},options);
tableSchema.index({tenantId:1,companyId:1,scope:1,targetId:1},{unique:true,partialFilterExpression:{active:true}});
export const PriceTable=model('CrmPriceTable',tableSchema);
const sequenceSchema=new Schema({...scope,value:{type:Number,default:0},revision:{type:Number,default:0}},options);sequenceSchema.index({tenantId:1,companyId:1},{unique:true});
export const CatalogSequence=model('CrmCatalogSequence',sequenceSchema);
export const CatalogAudit=model('CrmCatalogAudit',new Schema({...scope,actorId:{type:Schema.Types.ObjectId,required:true},entityId:{type:Schema.Types.ObjectId,required:true},action:{type:String,required:true},version:{type:Number,required:true}},options));
export async function initializeCatalogModels(){await Promise.all([CatalogProduct.init(),PriceTable.init(),CatalogSequence.init(),CatalogAudit.init()]);}
