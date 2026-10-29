import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../apps/api/src/app.js';
import type { IdentityService } from '../../apps/api/src/modules/identity/service.js';
const origin = 'http://localhost:5173';
function setup() {
  const view = { user: { id: 'u', name: 'Test', email: 'test@example.invalid' }, tenant: { id: 't', name: 'Tenant', slug: 'tenant' }, companies: [{ id: 'c', name: 'Company' }], permissions: [] };
  const identity: IdentityService = { login: vi.fn().mockResolvedValue({ token: 'a'.repeat(64), maxAge: 3600000, view, context: { userId: 'u', tenantId: 't', companyIds: ['c'], permissions: [] } }), authenticate: vi.fn().mockResolvedValue(null), logout: vi.fn().mockResolvedValue(undefined) };
  return { identity, app: createApp({ origin, databaseReady: () => true, identity, secureCookies: true }) };
}
describe('authentication HTTP boundary (service stub; not MongoDB integration)', () => {
  it('rejects cross-origin mutations before checking credentials', async () => {
    const { app, identity } = setup();
    expect((await request(app).post('/api/v1/auth/login').set('Origin', 'https://attacker.invalid').send({})).status).toBe(403);
    expect(identity.login).not.toHaveBeenCalled();
  });
  it('returns a protected cookie without exposing the token in JSON', async () => {
    const { app } = setup();
    const result = await request(app).post('/api/v1/auth/login').set('Origin', origin).send({ email: 'test@example.invalid', password: 'test-password-123' });
    expect(result.status).toBe(200);
    expect(String(result.headers['set-cookie'])).toContain('HttpOnly');
    expect(String(result.headers['set-cookie'])).toContain('SameSite=Strict');
    expect(String(result.headers['set-cookie'])).toContain('Secure');
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body).not.toHaveProperty('token');
  });
  it('ignores forged identity headers', async () => {
    const { app, identity } = setup();
    expect((await request(app).get('/api/v1/auth/session').set('x-tenant-id', 't')).status).toBe(401);
    expect(identity.authenticate).not.toHaveBeenCalled();
  });
  it('revokes the cookie token on logout', async () => {
    const { app, identity } = setup();
    const response = await request(app).post('/api/v1/auth/logout').set('Origin', origin).set('Cookie', 'nf_session=' + 'a'.repeat(64));
    expect(response.status).toBe(204);
    expect(identity.logout).toHaveBeenCalledWith('a'.repeat(64));
  });
  it('limits repeated attempts', async () => {
    const { app } = setup();
    for (let i = 0; i < 10; i++) await request(app).post('/api/v1/auth/login').set('Origin', origin).send({});
    expect((await request(app).post('/api/v1/auth/login').set('Origin', origin).send({})).status).toBe(429);
  });
});
