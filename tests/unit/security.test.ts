import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword, newSessionToken, tokenHash, readSessionCookie } from '../../apps/api/src/modules/identity/security.js';
describe('identity security', () => {
  it('salts hashes and rejects the wrong password', async () => {
    const password = 'a-strong-local-test-password';
    const first = await hashPassword(password), second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword('wrong', first)).toBe(false);
  });
  it('rejects malformed hashes and invalid password sizes', async () => {
    expect(await verifyPassword('abc', 'invalid')).toBe(false);
    await expect(hashPassword('short')).rejects.toThrow();
    await expect(hashPassword('a'.repeat(1025))).rejects.toThrow();
  });
  it('stores only a digest of an unpredictable token', () => {
    const token = newSessionToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash(token)).not.toBe(token);
    expect(tokenHash(token)).toBe(tokenHash(token));
  });
  it('rejects duplicate cookies, malformed values and partial name matches', () => {
    const token = newSessionToken();
    expect(readSessionCookie('nf_session=' + token)).toBe(token);
    expect(readSessionCookie('nf_session=' + token + '; nf_session=' + token)).toBeNull();
    expect(readSessionCookie('other_nf_session=' + token)).toBeNull();
    expect(readSessionCookie('nf_session=invalid')).toBeNull();
  });
});
