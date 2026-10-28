import assert from 'node:assert/strict';
import { companyScope, scopedFilter } from '../../apps/api/src/infrastructure/access.ts';
const context = { userId: 'user-a', tenantId: 'tenant-a', companyIds: ['company-a'], permissions: ['lead:read'] };
assert.deepEqual(companyScope(context, 'company-a', 'lead:read'), { tenantId: 'tenant-a', companyId: 'company-a' });
assert.throws(() => companyScope(context, 'company-b', 'lead:read'));
assert.throws(() => companyScope(context, 'company-a', 'lead:write'));
assert.throws(() => companyScope({ ...context, userId: '' }, 'company-a', 'lead:read'));
assert.deepEqual(scopedFilter(context, 'company-a', 'lead:read', { tenantId: 'tenant-b' }).$and[0], { tenantId: 'tenant-a', companyId: 'company-a' });
console.info('PASS: 5 access boundary checks. This does not validate database isolation.');