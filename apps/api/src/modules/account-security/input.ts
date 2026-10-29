import {z} from 'zod';
import {privacyVersion} from '../../../../../packages/contracts/src/privacy.js';
export const passwordInput=z.string().min(12).refine(value=>Buffer.byteLength(value,'utf8')<=1024);
export const changePasswordInput=z.object({currentPassword:z.string().min(1).refine(value=>Buffer.byteLength(value,'utf8')<=1024),newPassword:passwordInput}).strict();
export const forgotPasswordInput=z.object({email:z.string().trim().toLowerCase().pipe(z.email().max(254))}).strict();
export const resetPasswordInput=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),newPassword:passwordInput}).strict();
export const privacyAcceptanceInput=z.object({version:z.literal(privacyVersion),accepted:z.literal(true)}).strict();
