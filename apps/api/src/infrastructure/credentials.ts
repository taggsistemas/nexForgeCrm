import { z } from 'zod';
export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(1).refine(value => Buffer.byteLength(value,'utf8') <= 1024),
}).strict();
