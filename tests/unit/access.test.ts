import { describe, expect, it } from 'vitest';
import { companyScope, scopedFilter } from '../../apps/api/src/infrastructure/access.js';
import type { AccessContext } from '../../packages/contracts/src/index.js';
const context: AccessContext = { userId: 'user-a', tenantId: 'tenant-a', companyIds: ['company-a'], permissions: ['lead:read'] };
describe('tenant and company boundary', () => {
  it('scopes an authorized operation', () => { expect(companyScope(context, 'company-a', 'lead:read')).toEqual({ tenantId: 'tenant-a', companyId: 'company-a' }); });
  it('rejects another company', () => { expect(() => companyScope(context, 'company-b', 'lead:read')).toThrow(); });
  it('rejects an ungranted permission', () => { expect(() => companyScope(context, 'company-a', 'lead:write')).toThrow(); });
  it('rejects missing verified identity', () => { expect(() => companyScope({ ...context, userId: '' }, 'company-a', 'lead:read')).toThrow(); });
  it('does not let caller filters replace tenant scope', () => {
    const filter = scopedFilter(context, 'company-a', 'lead:read', { tenantId: 'tenant-b', $or: [{ companyId: 'company-b' }] });
    expect(filter.$and[0]).toEqual({ tenantId: 'tenant-a', companyId: 'company-a' });
    expect(filter.$and[1]).toHaveProperty('tenantId', 'tenant-b');
  });
});