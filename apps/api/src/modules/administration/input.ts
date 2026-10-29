import { z } from 'zod';
import { profileKeys } from '../../../../../packages/contracts/src/profiles.js';
import { normalizedEmail } from '../platform/client-input.js';
const id=z.string().regex(/^[a-f0-9]{24}$/i).transform(value=>value.toLowerCase());
const ids=z.array(id).max(100).refine(value=>new Set(value).size===value.length);
export const createUserInput=z.object({
  name:z.string().trim().min(1).max(120),email:normalizedEmail,
  password:z.string().min(12).refine(value=>Buffer.byteLength(value,'utf8')<=1024),
  profileKey:z.enum(profileKeys),companyIds:ids.refine(value=>value.length>0),
  supervisedUserIds:ids.default([]),supervisorId:id.nullable().optional(),regionIds:ids.optional(),
}).strict();
export const updateUserInput=z.object({
  version:z.number().int().min(0).optional(),profileKey:z.enum(profileKeys),active:z.boolean(),supervisedUserIds:ids.default([]),supervisorId:id.nullable().optional(),regionIds:ids.optional(),
}).strict();
export const userIdInput=id;
