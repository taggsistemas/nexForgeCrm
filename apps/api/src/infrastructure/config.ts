import { z } from 'zod';
const databaseSchema = z.object({ MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//) });
export function readDatabaseConfig(env: NodeJS.ProcessEnv) { return databaseSchema.parse(env); }
const schema = databaseSchema.extend({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PRIVACY_CONTACT_EMAIL:z.email().optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
}).refine(value => value.NODE_ENV !== 'production' || new URL(value.WEB_ORIGIN).protocol === 'https:', { message: 'Production requires HTTPS WEB_ORIGIN.' });
export function readConfig(env: NodeJS.ProcessEnv) { return schema.parse(env); }
