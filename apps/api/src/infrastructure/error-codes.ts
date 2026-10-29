const networkCodes = new Set([
  'EACCES', 'EPERM', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH',
  'ENOTFOUND', 'EAI_AGAIN', 'ENODATA', 'ESERVFAIL', 'ETIMEOUT',
]);
const certificateCodes = new Set([
  'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_GET_ISSUER_CERT', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_SIGNATURE_FAILURE', 'CERT_UNTRUSTED', 'CERT_REJECTED',
]);
const mongoCodes = new Set(['18', '13', '8000', '11000', '85', '86']);
export function safeErrorCode(code: unknown): string | undefined {
  if (typeof code === 'number') return mongoCodes.has(String(code)) ? String(code) : undefined;
  if (typeof code !== 'string') return undefined;
  // Native OpenSSL/TLS symbolic codes contain no message, endpoint or credential.
  if (networkCodes.has(code) || certificateCodes.has(code) || mongoCodes.has(code) || /^ERR_(?:SSL|TLS|OSSL)_[A-Z0-9_]{1,80}$/.test(code)) return code;
  return undefined;
}
export function isTlsErrorCode(code: unknown): boolean {
  const safe = safeErrorCode(code);
  return Boolean(safe && (certificateCodes.has(safe) || /^ERR_(?:SSL|TLS|OSSL)_/.test(safe)));
}
