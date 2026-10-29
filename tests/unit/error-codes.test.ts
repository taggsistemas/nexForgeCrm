import { describe, expect, it } from 'vitest';
import { safeErrorCode, isTlsErrorCode } from '../../apps/api/src/infrastructure/error-codes.js';
describe('shared safe error codes', () => {
  it.each([
    'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR', 'ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE',
    'ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'CERT_NOT_YET_VALID', 'DEPTH_ZERO_SELF_SIGNED_CERT',
  ])('preserves native TLS code %s', code => {
    expect(safeErrorCode(code)).toBe(code);
    expect(isTlsErrorCode(code)).toBe(true);
  });
  it('rejects arbitrary raw values instead of printing them as codes', () => {
    for (const code of ['mongodb://user:private-password@private-host/db', 'ERR_SSL_private-password', 'ERR_SSL_ALERT\nprivate-password', 'ERR_SSL_' + 'A'.repeat(100), null, {}, 12345]) expect(safeErrorCode(code)).toBeUndefined();
    expect(safeErrorCode('EACCES')).toBe('EACCES');
    expect(isTlsErrorCode('EACCES')).toBe(false);
    expect(safeErrorCode(18)).toBe('18');
  });
});
