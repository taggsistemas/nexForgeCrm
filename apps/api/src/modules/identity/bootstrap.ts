import { createDefaultProfiles } from './default-profiles.js';
import mongoose from 'mongoose';
import { z } from 'zod';
import { readConfig } from '../../infrastructure/config.js';
import { Company, Membership, Role, Session, Tenant, User } from './models.js';
import { hashPassword } from './security.js';
const input = z.object({
  CRM_BOOTSTRAP_EMAIL: z.email().max(254).transform(value => value.toLowerCase()),
  CRM_BOOTSTRAP_PASSWORD: z.string().min(12),
  CRM_BOOTSTRAP_NAME: z.string().min(1).max(120),
  CRM_BOOTSTRAP_TENANT: z.string().min(1).max(160),
  CRM_BOOTSTRAP_SLUG: z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  CRM_BOOTSTRAP_COMPANY: z.string().min(1).max(160),
});
async function bootstrap() {
  const parsed = input.safeParse(process.env);
  if (!parsed.success) throw new Error('Configure todas as variáveis CRM_BOOTSTRAP_* conforme docs/authentication.md.');
  const data = parsed.data;
  const passwordHash = await hashPassword(data.CRM_BOOTSTRAP_PASSWORD);
  delete process.env.CRM_BOOTSTRAP_PASSWORD;
  const config = readConfig(process.env);
  await mongoose.connect(config.MONGODB_URI);
  try {
    await Promise.all([User.init(), Tenant.init(), Company.init(), Role.init(), Membership.init(), Session.init()]);
    await mongoose.connection.transaction(async session => {
      // No overwrite or privilege escalation for an existing identity.
      if (await User.exists({ email: data.CRM_BOOTSTRAP_EMAIL }).session(session)) throw new Error('Usuário já existe; bootstrap não altera contas existentes.');
      const [user] = await User.create([{ name: data.CRM_BOOTSTRAP_NAME, email: data.CRM_BOOTSTRAP_EMAIL, passwordHash }], { session });
      const [tenant] = await Tenant.create([{ name: data.CRM_BOOTSTRAP_TENANT, slug: data.CRM_BOOTSTRAP_SLUG, primaryAdminId: user._id }], { session });
      const [company] = await Company.create([{ name: data.CRM_BOOTSTRAP_COMPANY, tenantId: tenant._id }], { session });
      const [role] = await createDefaultProfiles(tenant._id,session);
      await Membership.create([{ userId: user._id, tenantId: tenant._id, companyIds: [company._id], roleIds: [role._id] }], { session });
    });
    console.info('Organização, empresa e administrador criados. Nenhuma senha foi exibida.');
  } finally { await mongoose.disconnect(); }
}
bootstrap().catch(() => { console.error('Bootstrap não concluído. Verifique configuração, duplicidade e MongoDB replica set; nenhuma credencial foi exibida.'); process.exitCode = 1; });
