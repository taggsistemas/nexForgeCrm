import { describe, expect, it, vi } from 'vitest';
import { diagnoseDatabaseNetwork, safeNetworkCode, type NetworkProbe } from '../../apps/api/src/modules/platform/network-diagnostics.js';
const uri = 'mongodb+srv://private-user:private-password@private-host.invalid/private-db';
function setup(): NetworkProbe {
  return { srv: vi.fn().mockResolvedValue([{ name: 'private-node.invalid', port: 27017 }]), addresses: vi.fn().mockResolvedValue([{ address: '192.0.2.1', family: 4 }, { address: '2001:db8::1', family: 6 }]), tcp: vi.fn().mockResolvedValue(undefined), tls: vi.fn().mockResolvedValue(undefined) };
}
describe('safe database network diagnostics', () => {
  it('reports TCP and validated TLS separately for IPv4 and IPv6 without revealing connection details', async () => {
    const probe = setup(), report = await diagnoseDatabaseNetwork(uri, probe);
    expect(report.status).toBe('network-ok');
    expect(report.checks.filter(check => check.stage === 'TCP')).toHaveLength(2);
    expect(report.checks.filter(check => check.stage === 'TLS')).toHaveLength(2);
    for (const secret of ['private-user', 'private-password', 'private-host', 'private-db', 'private-node', '192.0.2.1']) expect(JSON.stringify(report)).not.toContain(secret);
  });
  it('identifies SRV failure before any TCP attempt', async () => {
    const probe = setup(); vi.mocked(probe.srv).mockRejectedValue({ code: 'ENOTFOUND', message: uri });
    const report = await diagnoseDatabaseNetwork(uri, probe);
    expect(report).toMatchObject({ status: 'dns-failed', checks: [{ stage: 'DNS_SRV', code: 'ENOTFOUND' }] });
    expect(probe.tcp).not.toHaveBeenCalled();
  });
  it('preserves a denied connection code and does not attempt TLS on that address', async () => {
    const probe = setup(); vi.mocked(probe.tcp).mockRejectedValue({ code: 'EACCES', message: uri });
    const report = await diagnoseDatabaseNetwork(uri, probe);
    expect(report.checks.filter(check => check.stage === 'TCP').every(check => check.code === 'EACCES')).toBe(true);
    expect(probe.tls).not.toHaveBeenCalled();
  });
  it('distinguishes IPv6 failure from successful IPv4', async () => {
    const probe = setup(); vi.mocked(probe.tcp).mockImplementation(async (_address, _port, family) => { if (family === 6) throw { code: 'ENETUNREACH' }; });
    const report = await diagnoseDatabaseNetwork(uri, probe);
    expect(report.checks).toContainEqual({ stage: 'TCP', node: 1, family: 4, status: 'ok' });
    expect(report.checks).toContainEqual({ stage: 'TCP', node: 1, family: 6, status: 'failed', code: 'ENETUNREACH' });
  });
  it('does not suppress certificate errors', async () => {
    const probe = setup(); vi.mocked(probe.tls).mockRejectedValue({ code: 'CERT_HAS_EXPIRED' });
    expect((await diagnoseDatabaseNetwork(uri, probe)).checks).toContainEqual({ stage: 'TLS', node: 1, family: 4, status: 'failed', code: 'CERT_HAS_EXPIRED' });
  });
  it('handles invalid configuration and unexpected codes without revealing raw errors', async () => {
    expect((await diagnoseDatabaseNetwork('invalid')).status).toBe('invalid-config');
    expect(safeNetworkCode({ code: uri })).toBe('UNCLASSIFIED');
    expect(safeNetworkCode(null)).toBe('UNCLASSIFIED');
  });
});

it('bounds an unresponsive DNS probe without exposing the connection string', async () => {
  vi.useFakeTimers();
  try {
    const probe = setup();
    vi.mocked(probe.srv).mockImplementation(() => new Promise(() => {}));
    const pending = diagnoseDatabaseNetwork(uri, probe);
    await vi.advanceTimersByTimeAsync(6001);
    const report = await pending;
    expect(report).toMatchObject({ status: 'dns-failed', checks: [{ code: 'ETIMEDOUT' }] });
    expect(JSON.stringify(report)).not.toContain('private-password');
  } finally { vi.useRealTimers(); }
});

it('accepts a standard MongoDB seed list with separate database and authSource', async () => {
  const probe = setup();
  const standard = 'mongodb://user:fake%40password@node-one.invalid:27017,node-two.invalid:27018,node-three.invalid:27019/nexforgeCrm?ssl=true&replicaSet=test-rs&authSource=admin';
  const report = await diagnoseDatabaseNetwork(standard, probe);
  expect(report.status).toBe('network-ok');
  expect(probe.srv).not.toHaveBeenCalled();
  expect(probe.addresses).toHaveBeenCalledTimes(3);
  expect(probe.tcp).toHaveBeenCalledWith('192.0.2.1', 27018, 4);
  expect(probe.tls).toHaveBeenCalledTimes(6);
  expect(JSON.stringify(report)).not.toContain('fake');
  expect(JSON.stringify(report)).not.toContain('node-one');
});
it('rejects a database mistakenly appended to authSource', async () => {
  const probe = setup();
  const report = await diagnoseDatabaseNetwork('mongodb://user:fakepassword@node-one.invalid:27017,node-two.invalid:27017/?ssl=true&authSource=admin/nexforgeCrm', probe);
  expect(report.status).toBe('invalid-config');
  expect(probe.addresses).not.toHaveBeenCalled();
});
it('respects explicit TLS settings on standard connections and handles IPv6 literals', async () => {
  const probe = setup();
  expect((await diagnoseDatabaseNetwork('mongodb://[::1]:27017/test?tls=false', probe)).status).toBe('network-ok');
  expect(probe.srv).not.toHaveBeenCalled();
  expect(probe.addresses).toHaveBeenCalledWith('::1');
  expect(probe.tls).not.toHaveBeenCalled();
});

it('preserves OpenSSL alert codes in TLS results instead of UNCLASSIFIED', async () => {
  const probe = setup();
  vi.mocked(probe.tls).mockRejectedValue({ code: 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR', message: 'private-host private-password' });
  const report = await diagnoseDatabaseNetwork(uri, probe);
  expect(report.checks).toContainEqual({ stage: 'TCP', node: 1, family: 4, status: 'ok' });
  expect(report.checks).toContainEqual({ stage: 'TLS', node: 1, family: 4, status: 'failed', code: 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR' });
  expect(JSON.stringify(report)).not.toContain('private-password');
});
it('finds nested TLS errors and tolerates cyclic error causes', () => {
  expect(safeNetworkCode({ cause: { errors: [{ code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' }] } })).toBe('UNABLE_TO_GET_ISSUER_CERT_LOCALLY');
  const cyclic: { cause?: unknown } = {}; cyclic.cause = cyclic;
  expect(safeNetworkCode(cyclic)).toBe('UNCLASSIFIED');
});
