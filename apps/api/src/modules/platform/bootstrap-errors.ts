import { safeErrorCode, isTlsErrorCode } from '../../infrastructure/error-codes.js';
export type BootstrapStage = 'configuration' | 'connection' | 'lookup' | 'input' | 'indexes' | 'save';
const messages = {
  CONFIG_DB_URI: 'MONGODB_URI está ausente ou tem formato inválido no .env da raiz.',
  INVALID_NAME: 'Informe um nome entre 1 e 120 caracteres.',
  INVALID_EMAIL: 'Informe um e-mail válido de até 254 caracteres.',
  PASSWORD_POLICY: 'A senha precisa ter pelo menos 12 caracteres e no máximo 1024 bytes.',
  PASSWORD_CONFIRMATION: 'A senha e a confirmação não coincidem. Digite novamente.',
  INPUT_REQUIRED: 'Execute em um terminal interativo ou configure TAGGMASTER_NAME, TAGGMASTER_EMAIL e TAGGMASTER_PASSWORD.',
  MASTER_EXISTS: 'Já existe um Tagg Master. Nenhuma conta ou senha foi sobrescrita; use /taggmaster.',
  DB_AUTH_FAILED: 'O MongoDB recusou a autenticação. Confira o usuário e a senha do banco em MONGODB_URI.',
  DB_FORBIDDEN: 'O usuário definido em MONGODB_URI não tem permissão para esta operação no banco do CRM. No Atlas, confira a função readWrite no banco nexforgeCrm.',
  DB_DNS_FAILED: 'Não foi possível resolver o endereço do MongoDB. Verifique DNS, internet e o endereço configurado.',
  DB_NETWORK_FAILED: 'Não foi possível acessar o MongoDB. Verifique conexão, firewall e, no Atlas, a lista de IPs permitidos.',
  DB_TLS_FAILED: 'A conexão TLS com o MongoDB falhou. Confira certificados e a configuração de conexão.',
  DB_INVALID_URI: 'O driver recusou MONGODB_URI. Confira o formato e a codificação dos caracteres especiais da senha do banco.',
  DB_INDEX_CONFLICT: 'Há conflito de índices na coleção de administradores da plataforma. Nenhum índice existente foi removido.',
  DB_CONNECTION_FAILED: 'A conexão com o MongoDB falhou. Verifique endereço, autenticação e acesso de rede.',
  CANCELLED: 'Operação cancelada. Nenhuma credencial foi exibida.',
  BOOTSTRAP_FAILED: 'A operação falhou nesta etapa. Informe apenas o código e a etapa exibidos para diagnóstico.',
} as const;
export type BootstrapCode = keyof typeof messages;
export class BootstrapFailure extends Error {
  code: BootstrapCode;
  stage: BootstrapStage;
  technicalCodes: string[];
  constructor(code: BootstrapCode, stage: BootstrapStage, technicalCodes: string[] = []) {
    super(messages[code]); this.name = 'BootstrapFailure'; this.code = code; this.stage = stage; this.technicalCodes = technicalCodes;
  }
}
function errorDetails(error: unknown) {
  const pending: unknown[] = [error], visited = new Set<unknown>(), codes: string[] = [], names: string[] = [];
  let authFailed = false, tlsFailed = false, forbidden = false;
  while (pending.length && visited.size < 30) {
    const current = pending.shift();
    if (!current || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);
    const value = current as { code?: unknown; name?: unknown; message?: unknown; cause?: unknown; reason?: unknown; error?: unknown; servers?: unknown; errors?: unknown; originalError?: unknown };
    if (typeof value.code === 'number' || typeof value.code === 'string') codes.push(String(value.code));
    if (typeof value.name === 'string') names.push(value.name);
    // Inspect text only to classify; never return or display driver messages.
    if (typeof value.message === 'string' && /authentication failed|bad auth/i.test(value.message)) authFailed = true;
    if (typeof value.message === 'string' && /not authorized|not allowed to do action|unauthorized|insufficient privileges/i.test(value.message)) forbidden = true;
    if (typeof value.message === 'string' && /SSL routines|tlsv1 alert|certificate verify failed|unable to get local issuer/i.test(value.message)) tlsFailed = true;
    pending.push(value.cause, value.reason, value.error, value.originalError);
    if (Array.isArray(value.errors)) pending.push(...value.errors);
    if (value.servers instanceof Map) pending.push(...value.servers.values());
  }
  return { codes, names, authFailed, tlsFailed, forbidden };
}
export function classifyBootstrapError(error: unknown, stage: BootstrapStage): BootstrapFailure {
  if (error instanceof BootstrapFailure) return error;
  const { codes, names, authFailed, tlsFailed, forbidden } = errorDetails(error);
  const has = (...values: string[]) => values.some(value => codes.includes(value));
  let code: BootstrapCode = 'BOOTSTRAP_FAILED';
  if (names.includes('AbortError')) code = 'CANCELLED';
  else if (has('18') || authFailed) code = 'DB_AUTH_FAILED';
  else if (has('13') || forbidden) code = 'DB_FORBIDDEN';
  else if (has('11000')) code = 'MASTER_EXISTS';
  else if (has('85', '86')) code = 'DB_INDEX_CONFLICT';
  else if (has('ENOTFOUND', 'EAI_AGAIN', 'ENODATA', 'ESERVFAIL', 'ETIMEOUT')) code = 'DB_DNS_FAILED';
  else if (tlsFailed || codes.some(isTlsErrorCode)) code = 'DB_TLS_FAILED';
  else if (has('EACCES', 'EPERM', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH')) code = 'DB_NETWORK_FAILED';
  else if (names.includes('MongoParseError') || names.includes('MongoInvalidArgumentError')) code = 'DB_INVALID_URI';
  else if (stage === 'connection') code = 'DB_CONNECTION_FAILED';
  return new BootstrapFailure(code, stage, [...new Set(codes.map(safeErrorCode).filter((value): value is string => Boolean(value)))]);
}
export function formatBootstrapError(error: unknown): string {
  const safe = error instanceof BootstrapFailure ? error : classifyBootstrapError(error, 'configuration');
  return 'Tagg Master não criado [' + safe.code + '] (etapa: ' + safe.stage + '). ' + safe.message + (safe.technicalCodes.length ? ' Códigos técnicos: ' + safe.technicalCodes.join(', ') + '.' : '');
}
