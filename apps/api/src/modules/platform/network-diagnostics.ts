import { safeErrorCode } from '../../infrastructure/error-codes.js';
import { mongo } from 'mongoose';
import { resolveSrv, lookup } from 'node:dns/promises';
import { connect as connectTcp, type Socket } from 'node:net';
import { connect as connectTls } from 'node:tls';
export function safeNetworkCode(error: unknown): string {
  const pending: unknown[] = [error], visited = new Set<unknown>();
  while (pending.length && visited.size < 20) {
    const current = pending.shift();
    if (!current || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);
    const value = current as { code?: unknown; cause?: unknown; errors?: unknown };
    const code = safeErrorCode(value.code);
    if (code) return code;
    pending.push(value.cause);
    if (Array.isArray(value.errors)) pending.push(...value.errors);
  }
  return 'UNCLASSIFIED';
}
interface Target { name: string; port: number }
interface Address { address: string; family: number }
export interface NetworkProbe {
  srv: (name: string) => Promise<Target[]>;
  addresses: (name: string) => Promise<Address[]>;
  tcp: (address: string, port: number, family: number) => Promise<void>;
  tls: (address: string, port: number, family: number, servername: string) => Promise<void>;
}
function socketProbe(address: string, port: number, family: number, servername?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let socket: Socket | undefined, finished = false;
    const finish = (error?: unknown) => {
      if (finished) return;
      finished = true; clearTimeout(timer); socket?.destroy();
      if (error) reject(error); else resolve();
    };
    const timer = setTimeout(() => finish(Object.assign(new Error(), { code: 'ETIMEDOUT' })), 4000);
    try {
      socket = servername ? connectTls({ host: address, port, servername, rejectUnauthorized: true }) : connectTcp({ host: address, port, family });
      socket.once(servername ? 'secureConnect' : 'connect', () => finish());
      socket.once('error', finish);
    } catch (error) { finish(error); }
  });
}
const realProbe: NetworkProbe = {
  srv: name => resolveSrv(name),
  addresses: name => lookup(name, { all: true }),
  tcp: (address, port, family) => socketProbe(address, port, family),
  tls: (address, port, family, servername) => socketProbe(address, port, family, servername),
};
async function deadline<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<T>((_resolve, reject) => { timer = setTimeout(() => reject(Object.assign(new Error(), { code: 'ETIMEDOUT' })), 6000); })]);
  } finally { clearTimeout(timer); }
}
interface Check { stage: 'DNS_SRV' | 'DNS_ADDRESS' | 'TCP' | 'TLS'; node?: number; family?: number; status: 'ok' | 'failed'; code?: string }
export async function diagnoseDatabaseNetwork(uri: string, probe: NetworkProbe = realProbe) {
  let options: mongo.MongoClient['options'];
  try {
    // Use the same parser as the application driver: WHATWG URL rejects valid seed lists.
    const client = new mongo.MongoClient(uri);
    options = client.options;
    if (options.credentials?.source.includes('/')) return { status: 'invalid-config', checks: [] as Check[] };
  } catch { return { status: 'invalid-config', checks: [] as Check[] }; }
  const checks: Check[] = [];
  let targets: Target[];
  if (options.srvHost) {
    try {
      targets = await deadline(probe.srv('_mongodb._tcp.' + options.srvHost));
      if (!targets.length) throw Object.assign(new Error(), { code: 'ENODATA' });
      checks.push({ stage: 'DNS_SRV', status: 'ok' });
    } catch (error) {
      checks.push({ stage: 'DNS_SRV', status: 'failed', code: safeNetworkCode(error) });
      return { status: 'dns-failed', checks };
    }
  } else {
    targets = options.hosts.filter(host => Boolean(host.host)).map(host => ({ name: host.host!, port: host.port ?? 27017 }));
    if (!targets.length) return { status: 'invalid-config', checks: [] as Check[] };
  }
  // Report only ordinal node identifiers. No host, IP, user, database or URI is returned.
  const results = await Promise.all(targets.slice(0, 3).map(async (target, index) => {
    const local: Check[] = [], node = index + 1;
    let addresses: Address[];
    try {
      addresses = await deadline(probe.addresses(target.name));
      if (!addresses.length) throw Object.assign(new Error(), { code: 'ENODATA' });
      local.push({ stage: 'DNS_ADDRESS', node, status: 'ok' });
    } catch (error) { return [{ stage: 'DNS_ADDRESS', node, status: 'failed', code: safeNetworkCode(error) }] as Check[]; }
    for (const family of [4, 6]) {
      const address = addresses.find(value => value.family === family);
      if (!address) continue;
      try {
        await deadline(probe.tcp(address.address, target.port, family));
        local.push({ stage: 'TCP', node, family, status: 'ok' });
      } catch (error) { local.push({ stage: 'TCP', node, family, status: 'failed', code: safeNetworkCode(error) }); continue; }
      // Atlas requires TLS; direct connections follow their explicit TLS setting.
      const tls = Boolean(options.tls);
      if (tls) {
        try {
          await deadline(probe.tls(address.address, target.port, family, target.name));
          local.push({ stage: 'TLS', node, family, status: 'ok' });
        } catch (error) { local.push({ stage: 'TLS', node, family, status: 'failed', code: safeNetworkCode(error) }); }
      }
    }
    return local;
  }));
  checks.push(...results.flat());
  return { status: checks.some(check => check.status === 'failed') ? 'failures-detected' : 'network-ok', checks };
}
