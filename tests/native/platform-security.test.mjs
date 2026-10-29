import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readOpaqueCookie, readSessionCookie } from '../../apps/api/src/modules/identity/security.ts';
test('platform and tenant sessions use separate cookies', () => {
  const tenant = 'a'.repeat(64), master = 'b'.repeat(64);
  assert.equal(readOpaqueCookie('nf_session=' + tenant, 'nf_master_session'), null);
  assert.equal(readSessionCookie('nf_master_session=' + master), null);
  const both = 'nf_session=' + tenant + '; nf_master_session=' + master;
  assert.equal(readSessionCookie(both), tenant);
  assert.equal(readOpaqueCookie(both, 'nf_master_session'), master);
});
test('ambiguous or malformed master cookies cannot authenticate', () => {
  const token = 'a'.repeat(64);
  for (const cookie of [
    'nf_master_session=' + token + '; nf_master_session=' + token,
    'fake_nf_master_session=' + token,
    'nf_master_session=invalid',
    'nf_master_session=' + 'a'.repeat(63),
    'nf_master_session=' + '%61'.repeat(64),
  ]) assert.equal(readOpaqueCookie(cookie, 'nf_master_session'), null);
});
