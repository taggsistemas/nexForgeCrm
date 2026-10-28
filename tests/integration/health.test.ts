import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../apps/api/src/app.js';
const app = createApp({ origin: 'http://localhost:5173', databaseReady: () => false });
describe('HTTP foundation', () => {
  it('reports liveness without leaking configuration', async () => {
    const response = await request(app).get('/api/v1/health/live');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'nexforge-crm' });
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
  it('reports a missing database as unavailable', async () => { expect((await request(app).get('/api/v1/health/ready')).status).toBe(503); });
  it('reports a connected database as ready', async () => {
    const ready = createApp({ origin: 'http://localhost:5173', databaseReady: () => true });
    expect((await request(ready).get('/api/v1/health/ready')).status).toBe(200);
  });
  it('does not accept forged tenant headers as authentication', async () => {
    const response = await request(app).get('/api/v1/leads').set('x-tenant-id', 'victim').set('x-user-id', 'admin');
    expect(response.status).toBe(401);
  });
  it('handles malformed JSON without leaking stack traces', async () => {
    const response = await request(app).post('/api/v1/leads').set('Content-Type', 'application/json').send('{');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ code: 'INVALID_REQUEST' });
  });
});