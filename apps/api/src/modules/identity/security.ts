import { randomBytes, scrypt as derive, timingSafeEqual, createHash } from 'node:crypto';
const N = 32768, r = 8, p = 1, maxmem = 64 * 1024 * 1024;
function scrypt(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => derive(password, salt, 64, { N, r, p, maxmem }, (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashPassword(password: string) {
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 1024) throw new Error('A senha deve ter pelo menos 12 caracteres e no máximo 1024 bytes.');
  const salt = randomBytes(16).toString('hex');
  return ['scrypt', N, r, p, salt, (await scrypt(password, salt)).toString('hex')].join('$');
}
export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, cost, block, parallel, salt, hash, extra] = encoded.split('$');
  if (extra || algorithm !== 'scrypt' || cost !== String(N) || block !== String(r) || parallel !== String(p) || !/^[a-f0-9]{32}$/.test(salt ?? '') || !/^[a-f0-9]{128}$/.test(hash ?? '') || Buffer.byteLength(password, 'utf8') > 1024) return false;
  return timingSafeEqual(await scrypt(password, salt), Buffer.from(hash, 'hex'));
}
export function newSessionToken() { return randomBytes(32).toString('hex'); }
export function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex'); }
export function readOpaqueCookie(header: string | undefined, name: 'nf_session' | 'nf_master_session') {
  const prefix = name + '=';
  const cookies = (header ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith(prefix));
  if (cookies.length !== 1) return null;
  const token = cookies[0].slice(prefix.length);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export function readSessionCookie(header: string | undefined) { return readOpaqueCookie(header, 'nf_session'); }
