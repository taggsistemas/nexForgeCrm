import { z } from 'zod';
const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
});
export function readConfig(env: NodeJS.ProcessEnv) { return schema.parse(env); }