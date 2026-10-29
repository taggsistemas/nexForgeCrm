import { Schema, model } from 'mongoose';
const options = { timestamps: true, strict: 'throw' } as const;
// Platform principals are deliberately NOT tenant users or tenant roles.
const adminSchema = new Schema({
  name: { type: String, required: true, maxlength: 120 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  active: { type: Boolean, default: true },
}, options);
adminSchema.index({ email: 1 }, { unique: true });
export const PlatformAdmin = model('PlatformAdmin', adminSchema);
const sessionSchema = new Schema({
  tokenHash: { type: String, required: true, select: false },
  adminId: { type: Schema.Types.ObjectId, required: true, ref: 'PlatformAdmin' },
  expiresAt: { type: Date, required: true },
}, options);
sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const PlatformSession = model('PlatformSession', sessionSchema);
const auditSchema = new Schema({
  adminId: { type: Schema.Types.ObjectId, required: true, ref: 'PlatformAdmin' },
  tenantId: { type: Schema.Types.ObjectId, required: true, ref: 'Tenant' },
  action: { type: String, enum: ['client.created', 'client.activated', 'client.suspended'], required: true },
}, options);
auditSchema.index({ tenantId: 1, createdAt: -1 });
export const PlatformAudit = model('PlatformAudit', auditSchema);
