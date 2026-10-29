import { customerRegistrationFixture } from '../fixtures/customer.js';
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../apps/api/src/app.js';
import type { PlatformAuth } from '../../apps/api/src/modules/platform/auth.js';
import { ClientConflict, type PlatformClients } from '../../apps/api/src/modules/platform/clients.js';
const origin = 'http://localhost:5173', token = 'a'.repeat(64);
const admin = { id: '000000000000000000000001', name: 'Master Test', email: 'master@example.invalid' };
const input = { ...customerRegistrationFixture, name: 'Client Test', slug: 'client-test', companyName: 'Company', adminName: 'Admin', adminEmail: 'admin@example.invalid', adminPassword: 'integration-test-password' };
function setup(authorized = false) {
  const auth: PlatformAuth = {
    login: vi.fn().mockResolvedValue({ token, maxAge: 7200000, admin }),
    authenticate: vi.fn().mockResolvedValue(authorized ? admin : null),
    logout: vi.fn().mockResolvedValue(undefined),
  };
  const clients: PlatformClients = {
    list: vi.fn().mockResolvedValue({ items: [], page: 1, total: 0, pageSize: 20 }),
    create: vi.fn().mockResolvedValue({ id: 'a'.repeat(24), name: input.name, slug: input.slug, active: true, companyName: input.companyName, admin: { name: input.adminName, email: input.adminEmail }, createdAt: new Date().toISOString() }),
    setSubscription:vi.fn(),setActive: vi.fn().mockResolvedValue({ id: 'a'.repeat(24), active: false }),
  };
  return { auth, clients, app: createApp({ origin, databaseReady: () => true, secureCookies: true, platform: { auth, clients } }) };
}
describe('Tagg Master HTTP boundary', () => {
  it('refuses a tenant cookie and forged master headers', async () => {
    const { app, auth, clients } = setup(true);
    const response = await request(app).get('/api/v1/taggmaster/clients').set('Cookie', 'nf_session=' + token).set('x-role', 'taggmaster').set('x-user-id', admin.id);
    expect(response.status).toBe(401);
    expect(auth.authenticate).not.toHaveBeenCalled();
    expect(clients.list).not.toHaveBeenCalled();
  });
  it('requires an active platform session for client creation', async () => {
    const { app, clients } = setup(false);
    const response = await request(app).post('/api/v1/taggmaster/clients').set('Origin', origin).set('Cookie', 'nf_master_session=' + token).send(input);
    expect(response.status).toBe(401);
    expect(clients.create).not.toHaveBeenCalled();
  });
  it('rejects cross-origin writes before authenticating', async () => {
    const { app, auth } = setup(true);
    const response = await request(app).post('/api/v1/taggmaster/clients').set('Origin', 'https://attacker.invalid').send(input);
    expect(response.status).toBe(403);
    expect(auth.authenticate).not.toHaveBeenCalled();
  });
  it('uses a separate protected cookie and never returns the token', async () => {
    const { app } = setup();
    const response = await request(app).post('/api/v1/taggmaster/login').set('Origin', origin).send({ email: admin.email, password: 'test-password' });
    expect(response.status).toBe(200);
    expect(String(response.headers['set-cookie'])).toContain('nf_master_session=');
    expect(String(response.headers['set-cookie'])).toContain('Path=/api/v1/taggmaster');
    expect(String(response.headers['set-cookie'])).toContain('HttpOnly');
    expect(String(response.headers['set-cookie'])).toContain('Secure');
    expect(String(response.headers['set-cookie'])).toContain('SameSite=Strict');
    expect(response.body).toEqual({ admin });
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('lists only after master verification and rejects invalid pagination', async () => {
    const { app, clients } = setup(true);
    expect((await request(app).get('/api/v1/taggmaster/clients?page=1&search=client').set('Cookie', 'nf_master_session=' + token)).status).toBe(200);
    expect(clients.list).toHaveBeenCalledWith({ page: 1, search: 'client' });
    expect((await request(app).get('/api/v1/taggmaster/clients?page=-1').set('Cookie', 'nf_master_session=' + token)).status).toBe(400);
  });
  it('creates a client using the verified master identity', async () => {
    const { app, clients } = setup(true);
    const response = await request(app).post('/api/v1/taggmaster/clients').set('Origin', origin).set('Cookie', 'nf_master_session=' + token).send(input);
    expect(response.status).toBe(201);
    expect(clients.create).toHaveBeenCalledWith({...input,subscription:{mode:'paid',licenseLimit:25,baseMonthlyCents:null,extraSeatMonthlyCents:null}}, admin.id);
    expect(JSON.stringify(response.body)).not.toContain(input.adminPassword);
  });
  it('rejects password bounds and mass-assigned privileges', async () => {
    const { app, clients } = setup(true);
    for (const body of [{ ...input, adminPassword: 'short' }, { ...input, isMaster: true }, { ...input, adminPassword: 'a'.repeat(1025) }]) {
      expect((await request(app).post('/api/v1/taggmaster/clients').set('Origin', origin).set('Cookie', 'nf_master_session=' + token).send(body)).status).toBe(400);
    }
    expect(clients.create).not.toHaveBeenCalled();
  });
  it('returns a safe conflict without exposing database errors', async () => {
    const { app, clients } = setup(true);
    vi.mocked(clients.create).mockRejectedValue(new ClientConflict());
    const response = await request(app).post('/api/v1/taggmaster/clients').set('Origin', origin).set('Cookie', 'nf_master_session=' + token).send(input);
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ code: 'CLIENT_ALREADY_EXISTS' });
  });
  it('limits master login attempts', async () => {
    const { app } = setup();
    for (let i = 0; i < 10; i++) await request(app).post('/api/v1/taggmaster/login').set('Origin', origin).send({});
    expect((await request(app).post('/api/v1/taggmaster/login').set('Origin', origin).send({})).status).toBe(429);
  });
  it('validates status changes and revokes the correct cookie on logout', async () => {
    const { app, clients, auth } = setup(true);
    const headers = { Origin: origin, Cookie: 'nf_master_session=' + token };
    expect((await request(app).patch('/api/v1/taggmaster/clients/' + 'a'.repeat(24) + '/status').set(headers).send({ active: false })).status).toBe(200);
    expect(clients.setActive).toHaveBeenCalledWith('a'.repeat(24), false, admin.id);
    expect((await request(app).patch('/api/v1/taggmaster/clients/invalid/status').set(headers).send({ active: false })).status).toBe(400);
    expect((await request(app).post('/api/v1/taggmaster/logout').set(headers)).status).toBe(204);
    expect(auth.logout).toHaveBeenCalledWith(token);
  });
});
