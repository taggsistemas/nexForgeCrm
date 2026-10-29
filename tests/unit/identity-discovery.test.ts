import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ user: vi.fn(), memberships: vi.fn(), tenants: vi.fn(), create: vi.fn(), verify: vi.fn() }));
vi.mock('../../apps/api/src/modules/identity/models.js', () => ({
  User: { findOne: () => ({ select: mocks.user }) },
  Membership: { find: mocks.memberships },
  Tenant: { find: () => ({ limit: mocks.tenants }) },
  Company: {}, Role: {}, Session: { findOneAndUpdate: mocks.create },
}));
vi.mock('../../apps/api/src/modules/identity/security.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('dummy'), newSessionToken: () => 'opaque',
  tokenHash: () => 'digest', verifyPassword: mocks.verify,
}));
import { identityService } from '../../apps/api/src/modules/identity/service.js';
describe('organization discovery after password verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue({ _id: 'u', passwordHash: 'stored' });
    mocks.verify.mockResolvedValue(true);
    mocks.memberships.mockResolvedValue([]);
    mocks.tenants.mockResolvedValue([]);
  });
  it('does not look up organization membership for an invalid password', async () => {
    mocks.verify.mockResolvedValue(false);
    expect(await identityService.login('user@example.invalid', 'wrong')).toBeNull();
    expect(mocks.memberships).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('does not issue a session without an active organization', async () => {
    expect(await identityService.login('user@example.invalid', 'password')).toBeNull();
    expect(mocks.memberships).toHaveBeenCalledWith({ userId: 'u', active: true });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('does not silently select one of multiple active organizations', async () => {
    mocks.tenants.mockResolvedValue([{ _id: 'a' }, { _id: 'b' }]);
    expect(await identityService.login('user@example.invalid', 'password')).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
