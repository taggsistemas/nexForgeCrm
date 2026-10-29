import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, newSessionToken, tokenHash, readSessionCookie } from '../../apps/api/src/modules/identity/security.ts';
test('password salt, verification, bounds and malformed hashes', async () => {
  const password = 'test-password-with-twelve-characters';
  const first = await hashPassword(password), second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('wrong', first), false);
  assert.equal(await verifyPassword(password, 'invalid'), false);
  await assert.rejects(hashPassword('short'));
  await assert.rejects(hashPassword('a'.repeat(1025)));
});
test('session token digest and unambiguous cookie parsing', () => {
  const token = newSessionToken();
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.notEqual(tokenHash(token), token);
  assert.equal(readSessionCookie('nf_session=' + token), token);
  assert.equal(readSessionCookie('nf_session=' + token + '; nf_session=' + token), null);
  assert.equal(readSessionCookie('other_nf_session=' + token), null);
  assert.equal(readSessionCookie('nf_session=bad'), null);
});
