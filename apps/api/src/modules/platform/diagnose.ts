import { readDatabaseConfig } from '../../infrastructure/config.js';
import { diagnoseDatabaseNetwork } from './network-diagnostics.js';
async function diagnose() {
  const config = readDatabaseConfig(process.env);
  console.info('Diagnóstico de rede do CRM. Testa DNS, TCP e TLS; não cadastra contas nem envia credenciais ao banco.');
  const report = await diagnoseDatabaseNetwork(config.MONGODB_URI);
  console.info(JSON.stringify(report, null, 2));
  console.info('EACCES/EPERM: acesso de rede negado pelo sistema ou por uma política de segurança.');
  console.info('ECONNREFUSED: conexão recusada. ETIMEDOUT: não houve resposta no prazo.');
  console.info('TCP ok e TLS falhou: verificar o código do certificado/TLS. Somente IPv6 falhou: comparar com o resultado IPv4.');
  console.info('network-ok confirma apenas transporte, não autenticação, permissões ou cadastro master.');
  if (report.status !== 'network-ok') process.exitCode = 1;
}
function finish() {
  // DNS promises cannot be cancelled; do not leave a read-only diagnostic hanging after its deadline.
  process.stdout.write('', () => process.stderr.write('', () => process.exit(process.exitCode ?? 0)));
}
diagnose().then(finish).catch(() => { console.error('CONFIG_INVALID: confira MONGODB_URI no .env da raiz. Nenhum valor foi exibido.'); process.exitCode = 1; finish(); });
