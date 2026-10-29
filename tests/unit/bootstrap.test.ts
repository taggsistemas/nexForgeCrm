import { describe, expect, it, vi } from 'vitest';
import { collectMasterInput, runMasterBootstrap, type MasterSetupStore } from '../../apps/api/src/modules/platform/bootstrap-service.js';
import { BootstrapFailure, classifyBootstrapError, formatBootstrapError } from '../../apps/api/src/modules/platform/bootstrap-errors.js';
import { readDatabaseConfig } from '../../apps/api/src/infrastructure/config.js';
import { verifyPassword } from '../../apps/api/src/modules/identity/security.js';
const testPassword = 'test-password-for-bootstrap-only';
const uri = 'mongodb://127.0.0.1:27017/bootstrap_unit_test';
function setup() {
  const env = { MONGODB_URI: uri, TAGGMASTER_NAME: 'Master Test', TAGGMASTER_EMAIL: 'MASTER@example.invalid', TAGGMASTER_PASSWORD: testPassword };
  const store: MasterSetupStore = {
    connect: vi.fn().mockResolvedValue(undefined), exists: vi.fn().mockResolvedValue(false),
    initialize: vi.fn().mockResolvedValue(undefined), create: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined),
  };
  return { env, store };
}
describe('master bootstrap validation and orchestration', () => {
  it('uses only database configuration, independent of frontend settings', () => {
    expect(readDatabaseConfig({ MONGODB_URI: uri, PORT: 'invalid', WEB_ORIGIN: 'invalid', NODE_ENV: 'production' })).toEqual({ MONGODB_URI: uri });
  });
  it('checks connectivity without prompting, creating indexes or writing accounts', async () => {
    const { store } = setup(), prompt = vi.fn();
    expect(await runMasterBootstrap({ env: { MONGODB_URI: uri }, store, prompt, checkOnly: true })).toEqual({ status: 'missing' });
    expect(store.connect).toHaveBeenCalledWith(uri);
    expect(store.exists).toHaveBeenCalled();
    expect(prompt).not.toHaveBeenCalled();
    expect(store.initialize).not.toHaveBeenCalled();
    expect(store.create).not.toHaveBeenCalled();
    expect(store.close).toHaveBeenCalled();
  });
  it('preserves an existing master without prompting or resetting its password', async () => {
    const { env, store } = setup(), prompt = vi.fn();
    vi.mocked(store.exists).mockResolvedValue(true);
    expect(await runMasterBootstrap({ env, store, prompt })).toEqual({ status: 'exists' });
    expect(prompt).not.toHaveBeenCalled();
    expect(store.create).not.toHaveBeenCalled();
    expect(env).not.toHaveProperty('TAGGMASTER_PASSWORD');
  });
  it('stores only a password hash and normalizes the email', async () => {
    const { env, store } = setup();
    expect(await runMasterBootstrap({ env, store })).toEqual({ status: 'created' });
    const data = vi.mocked(store.create).mock.calls[0][0];
    expect(data.email).toBe('master@example.invalid');
    expect(data).not.toHaveProperty('password');
    expect(data.passwordHash).not.toContain(testPassword);
    expect(await verifyPassword(testPassword, data.passwordHash)).toBe(true);
    expect(store.close).toHaveBeenCalled();
    expect(env).not.toHaveProperty('TAGGMASTER_PASSWORD');
  });
  it('reports mismatched confirmation without writing', async () => {
    const { store } = setup();
    const answers = { name: 'Master Test', email: 'master@example.invalid', password: testPassword, confirmation: 'different-password' };
    await expect(runMasterBootstrap({ env: { MONGODB_URI: uri }, store, prompt: async field => answers[field] })).rejects.toMatchObject({ code: 'PASSWORD_CONFIRMATION', stage: 'input' });
    expect(store.create).not.toHaveBeenCalled();
    expect(store.initialize).not.toHaveBeenCalled();
    expect(store.close).toHaveBeenCalled();
  });
  it.each([
    ['TAGGMASTER_NAME', '', 'INVALID_NAME'],
    ['TAGGMASTER_EMAIL', 'invalid', 'INVALID_EMAIL'],
    ['TAGGMASTER_PASSWORD', 'short', 'PASSWORD_POLICY'],
    ['TAGGMASTER_PASSWORD', 'a'.repeat(1025), 'PASSWORD_POLICY'],
  ])('reports a specific input issue for %s', async (field, value, code) => {
    const { env } = setup();
    await expect(collectMasterInput({ ...env, [field]: value }, async () => value)).rejects.toMatchObject({ code });
  });
  it('requires interactive input when provisioning data is missing', async () => {
    await expect(collectMasterInput({})).rejects.toMatchObject({ code: 'INPUT_REQUIRED' });
  });
  it('reports configuration failure before connecting and still clears the secret', async () => {
    const { env, store } = setup(); env.MONGODB_URI = 'invalid';
    await expect(runMasterBootstrap({ env, store })).rejects.toMatchObject({ code: 'CONFIG_DB_URI', stage: 'configuration' });
    expect(store.connect).not.toHaveBeenCalled();
    expect(env).not.toHaveProperty('TAGGMASTER_PASSWORD');
  });
  it('checks the database before asking for a password and does not leak driver details', async () => {
    const { env, store } = setup(), prompt = vi.fn();
    vi.mocked(store.connect).mockRejectedValue({ code: 18, message: 'Authentication failed ' + testPassword + ' ' + uri });
    try {
      await runMasterBootstrap({ env, store, prompt });
      throw new Error('Expected authentication failure');
    } catch (error) {
      expect(error).toMatchObject({ code: 'DB_AUTH_FAILED', stage: 'connection' });
      expect(formatBootstrapError(error)).not.toContain(testPassword);
      expect(formatBootstrapError(error)).not.toContain(uri);
    }
    expect(prompt).not.toHaveBeenCalled();
    expect(store.create).not.toHaveBeenCalled();
    expect(store.close).toHaveBeenCalled();
  });
  it('identifies index and insertion stages without masking errors with cleanup failures', async () => {
    const { env, store } = setup();
    vi.mocked(store.initialize).mockRejectedValue({ code: 13, message: 'private server detail' });
    vi.mocked(store.close).mockRejectedValue(new Error('cleanup'));
    await expect(runMasterBootstrap({ env, store })).rejects.toMatchObject({ code: 'DB_FORBIDDEN', stage: 'indexes' });
    expect(store.create).not.toHaveBeenCalled();
    const second = setup();
    vi.mocked(second.store.create).mockRejectedValue({ code: 11000 });
    await expect(runMasterBootstrap(second)).rejects.toMatchObject({ code: 'MASTER_EXISTS', stage: 'save' });
  });
});
describe('safe bootstrap diagnostics', () => {
  it.each([
    [{ code: 18 }, 'DB_AUTH_FAILED'], [{ code: 13 }, 'DB_FORBIDDEN'],
    [{ cause: { code: 'ENOTFOUND' } }, 'DB_DNS_FAILED'],
    [{ reason: { servers: new Map([['redacted', { error: { code: 'ECONNREFUSED' } }]]) } }, 'DB_NETWORK_FAILED'],
    [{ code: 'ERR_TLS_CERT_ALTNAME_INVALID' }, 'DB_TLS_FAILED'],
    [{ name: 'MongoParseError' }, 'DB_INVALID_URI'], [{ code: 85 }, 'DB_INDEX_CONFLICT'],
  ])('classifies driver failures without using their text as output', (error, code) => {
    const failure = classifyBootstrapError(error, 'connection');
    expect(failure.code).toBe(code);
    expect(formatBootstrapError(failure)).toContain('[' + code + ']');
  });
  it('never displays unknown raw errors or secrets', () => {
    const failure = classifyBootstrapError(new Error('mongodb://private-user:private-password@private-host/database'), 'save');
    const text = formatBootstrapError(failure);
    expect(text).toContain('BOOTSTRAP_FAILED');
    expect(text).not.toContain('private-password');
    expect(text).not.toContain('private-host');
    expect(failure).toBeInstanceOf(BootstrapFailure);
  });
});

describe('nested network and TLS failures', () => {
  it('extracts the causes of AggregateError without disclosing raw errors', () => {
    const error = { reason: { servers: new Map([['private-host', { error: { cause: new AggregateError([Object.assign(new Error('private-secret'), { code: 'ETIMEDOUT' }), { code: 'EHOSTUNREACH' }]) } }]]) } };
    const failure = classifyBootstrapError(error, 'connection');
    expect(failure.code).toBe('DB_NETWORK_FAILED');
    expect(failure.technicalCodes).toEqual(['ETIMEDOUT', 'EHOSTUNREACH']);
    expect(formatBootstrapError(failure)).not.toContain('private-secret');
    expect(formatBootstrapError(failure)).not.toContain('private-host');
  });
  it.each(['ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'])('recognizes TLS code %s', code => {
    expect(classifyBootstrapError({ cause: { code } }, 'connection').code).toBe('DB_TLS_FAILED');
  });
  it('recognizes TLS handshake text but only displays a fixed safe message', () => {
    const failure = classifyBootstrapError({ originalError: new Error('SSL routines private-host private-password tlsv1 alert internal error') }, 'connection');
    expect(failure.code).toBe('DB_TLS_FAILED');
    expect(formatBootstrapError(failure)).not.toContain('private-');
  });
});

describe('Atlas authorization during master lookup', () => {
  it('recognizes Atlas action denial without revealing its namespace', () => {
    const failure = classifyBootstrapError({ name: 'MongoServerError', code: 8000, message: 'user is not allowed to do action [find] on [private-db.platformadmins]' }, 'lookup');
    expect(failure.code).toBe('DB_FORBIDDEN');
    expect(failure.technicalCodes).toEqual(['8000']);
    expect(formatBootstrapError(failure)).not.toContain('private-db');
  });
  it('distinguishes authentication failures and unknown Atlas errors from authorization', () => {
    expect(classifyBootstrapError({ code: 8000, message: 'bad auth : authentication failed' }, 'connection').code).toBe('DB_AUTH_FAILED');
    expect(classifyBootstrapError({ code: 8000, message: 'unknown private-message' }, 'lookup').code).toBe('BOOTSTRAP_FAILED');
    expect(formatBootstrapError(classifyBootstrapError({ code: 8000, message: 'unknown private-message' }, 'lookup'))).not.toContain('private-message');
  });
  it('never provisions a master if the existing-account query is denied', async () => {
    const { env, store } = setup();
    vi.mocked(store.exists).mockRejectedValue({ code: 8000, message: 'not authorized on private-db to execute find' });
    await expect(runMasterBootstrap({ env, store })).rejects.toMatchObject({ code: 'DB_FORBIDDEN', stage: 'lookup' });
    expect(store.initialize).not.toHaveBeenCalled();
    expect(store.create).not.toHaveBeenCalled();
    expect(store.close).toHaveBeenCalled();
  });
});
