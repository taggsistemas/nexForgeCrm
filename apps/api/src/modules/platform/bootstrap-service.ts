import { z } from 'zod';
import { readDatabaseConfig } from '../../infrastructure/config.js';
import { hashPassword } from '../identity/security.js';
import { BootstrapFailure, classifyBootstrapError, type BootstrapStage } from './bootstrap-errors.js';
export interface MasterSetupStore {
  connect: (uri: string) => Promise<void>;
  exists: () => Promise<boolean>;
  initialize: () => Promise<void>;
  create: (data: { name: string; email: string; passwordHash: string }) => Promise<void>;
  close: () => Promise<void>;
}
export type MasterPrompt = (field: 'name' | 'email' | 'password' | 'confirmation') => Promise<string>;
export async function collectMasterInput(env: NodeJS.ProcessEnv, prompt?: MasterPrompt) {
  let name = env.TAGGMASTER_NAME, email = env.TAGGMASTER_EMAIL, password = env.TAGGMASTER_PASSWORD;
  if ((!name || !email || !password) && !prompt) throw new BootstrapFailure('INPUT_REQUIRED', 'input');
  name ||= await prompt!('name');
  email ||= await prompt!('email');
  let confirmation = password;
  if (!password) { password = await prompt!('password'); confirmation = await prompt!('confirmation'); }
  const result = z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    password: z.string().min(12).refine(value => Buffer.byteLength(value, 'utf8') <= 1024),
  }).safeParse({ name, email, password });
  if (!result.success) {
    const field = result.error.issues[0]?.path[0];
    throw new BootstrapFailure(field === 'name' ? 'INVALID_NAME' : field === 'email' ? 'INVALID_EMAIL' : 'PASSWORD_POLICY', 'input');
  }
  if (password !== confirmation) throw new BootstrapFailure('PASSWORD_CONFIRMATION', 'input');
  return result.data;
}
export async function runMasterBootstrap(options: { env: NodeJS.ProcessEnv; store: MasterSetupStore; prompt?: MasterPrompt; checkOnly?: boolean }) {
  let stage: BootstrapStage = 'configuration';
  try {
    const config = readDatabaseConfig(options.env);
    stage = 'connection'; await options.store.connect(config.MONGODB_URI);
    stage = 'lookup';
    if (await options.store.exists()) return { status: 'exists' as const };
    if (options.checkOnly) return { status: 'missing' as const };
    stage = 'input';
    const input = await collectMasterInput(options.env, options.prompt);
    delete options.env.TAGGMASTER_PASSWORD;
    const passwordHash = await hashPassword(input.password);
    stage = 'indexes'; await options.store.initialize();
    stage = 'save'; await options.store.create({ name: input.name, email: input.email, passwordHash });
    return { status: 'created' as const };
  } catch (error) {
    // Config errors expose field names only, never the provided values.
    if (stage === 'configuration' && error instanceof z.ZodError) throw new BootstrapFailure('CONFIG_DB_URI', stage);
    throw classifyBootstrapError(error, stage);
  } finally {
    delete options.env.TAGGMASTER_PASSWORD;
    // Cleanup must not mask the original error or misreport a successful insert.
    await options.store.close().catch(() => {});
  }
}
