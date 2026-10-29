import { profileKeys } from '../../../../../packages/contracts/src/profiles.js';
import { Schema, model } from 'mongoose';
import { permissions } from '../../../../../packages/contracts/src/index.js';
const options = { timestamps: true, strict: 'throw' } as const;
const userSchema = new Schema({fieldRevision:{type:Number,default:0},
  name: { type: String, required: true, maxlength: 120 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  mustChangePassword: {type:Boolean,default:false},
  passwordVersion: {type:Number,default:0},
  passwordChangedAt: Date,
  passwordHash: { type: String, required: true, select: false },
  active: { type: Boolean, default: true },
}, options);
userSchema.index({ email: 1 }, { unique: true });
export const User = model('User', userSchema);
const customerAddressSchema = new Schema({
  postalCode: { type: String, required: true, maxlength: 20 }, street: { type: String, required: true, maxlength: 160 },
  number: { type: String, required: true, maxlength: 20 }, complement: { type: String, default: '', maxlength: 120 },
  neighborhood: { type: String, required: true, maxlength: 120 }, city: { type: String, required: true, maxlength: 120 },
  state: { type: String, required: true, maxlength: 60 }, country: { type: String, required: true, maxlength: 80 },
}, { _id: false, strict: 'throw', versionKey: false });
const customerRegistrationSchema = new Schema({
  taxId: { type: String, required: true, maxlength: 14 }, stateRegistration: { type: String, default: '', maxlength: 20 },
  contactName: { type: String, required: true, maxlength: 120 }, contactEmail: { type: String, required: true, maxlength: 254 },
  phone: { type: String, required: true, maxlength: 11 }, address: { type: customerAddressSchema, required: true },
  contract: { type: new Schema({ start: { type: String, required: true }, end: { type: String, required: true } }, { _id: false, strict: 'throw', versionKey: false }), required: true },
}, { _id: false, strict: 'throw', versionKey: false });
const subscriptionSchema=new Schema({mode:{type:String,enum:['paid','trial'],default:'paid'},licenseLimit:{type:Number,min:25,max:10000,default:25},baseMonthlyCents:{type:Number,default:null},extraSeatMonthlyCents:{type:Number,default:null},trialStartedAt:{type:Date,default:null},trialEndsAt:{type:Date,default:null}},{_id:false,strict:'throw',versionKey:false});
const tenantSchema = new Schema({
  subscription:{type:subscriptionSchema,default:()=>({})},subscriptionVersion:{type:Number,default:0},licenseRevision:{type:Number,default:0},
  name: { type: String, required: true, maxlength: 160 },
  registration: { type: customerRegistrationSchema, required: false },
  primaryAdminId: { type: Schema.Types.ObjectId, ref: 'User' },
  slug: { type: String, required: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, maxlength: 80 },
  active: { type: Boolean, default: true },
}, options);
tenantSchema.index({ slug: 1 }, { unique: true });
export const Tenant = model('Tenant', tenantSchema);
const companySchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, required: true, ref: 'Tenant' },
  name: { type: String, required: true, maxlength: 160 },
  active: { type: Boolean, default: true },
}, options);
companySchema.index({ tenantId: 1, _id: 1 });
export const Company = model('Company', companySchema);
const roleSchema = new Schema({
  key: {type:String,enum:[...profileKeys]},
  tenantId: { type: Schema.Types.ObjectId, required: true, ref: 'Tenant' },
  name: { type: String, required: true },
  permissions: [{ type: String, enum: [...permissions], required: true }],
}, options);
roleSchema.index({ tenantId: 1, name: 1 }, { unique: true });
roleSchema.index({ tenantId: 1, key: 1 }, {unique:true,partialFilterExpression:{key:{$type:'string'}}});
export const Role = model('Role', roleSchema);
const membershipSchema = new Schema({
  commercialRevision:{type:Number,default:0},adminVersion:{type:Number,default:0},supervisorId:{type:Schema.Types.ObjectId,default:null},regionIds:[{type:Schema.Types.ObjectId}],
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  tenantId: { type: Schema.Types.ObjectId, required: true, ref: 'Tenant' },
  companyIds: [{ type: Schema.Types.ObjectId, ref: 'Company' }],
  privacyVersion: {type:String,default:''},
  privacyAcceptedAt: Date,
  supervisedUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  roleIds: [{ type: Schema.Types.ObjectId, ref: 'Role' }],
  active: { type: Boolean, default: true },
}, options);
membershipSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
membershipSchema.index({tenantId:1,supervisorId:1,active:1});
export const Membership = model('Membership', membershipSchema);
const sessionSchema = new Schema({
  passwordVersion: {type:Number,default:0},
  tokenHash: { type: String, required: true, select: false },
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  tenantId: { type: Schema.Types.ObjectId, required: true, ref: 'Tenant' },
  expiresAt: { type: Date, required: true },
}, options);
sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Session = model('Session', sessionSchema);

