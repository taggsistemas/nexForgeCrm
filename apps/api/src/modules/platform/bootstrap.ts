import mongoose from 'mongoose';
import { createInterface, type Interface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { PlatformAdmin } from './models.js';
import { formatBootstrapError } from './bootstrap-errors.js';
import { runMasterBootstrap, type MasterPrompt, type MasterSetupStore } from './bootstrap-service.js';
const store: MasterSetupStore = {
  async connect(uri) {
    // No automatic collection/index writes during the connection diagnostic.
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, autoCreate: false, autoIndex: false });
  },
  async exists() { return Boolean(await PlatformAdmin.exists({})); },
  async initialize() {
    // Bootstrap only depends on its own collection, not tenant or client indexes.
    await PlatformAdmin.createCollection();
    await PlatformAdmin.createIndexes();
  },
  async create(data) { await PlatformAdmin.create({ _id: new mongoose.Types.ObjectId('000000000000000000000001'), ...data }); },
  async close() { await mongoose.disconnect(); },
};
async function bootstrapMaster() {
  let hidden = false;
  let prompt: Interface | undefined, output: Writable | undefined;
  const labels = { name: 'Nome do Tagg Master: ', email: 'E-mail do Tagg Master: ', password: 'Senha (mínimo 12 caracteres; digitação oculta): ', confirmation: 'Repita a senha: ' };
  const ask: MasterPrompt = async field => {
    if (!prompt) {
      output = new Writable({ write(chunk, _encoding, callback) { if (!hidden) process.stdout.write(chunk); callback(); } });
      prompt = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
    }
    if (field !== 'password' && field !== 'confirmation') return prompt.question(labels[field]);
    process.stdout.write(labels[field]); hidden = true;
    try { return await prompt.question(''); }
    finally { hidden = false; process.stdout.write('\n'); }
  };
  console.info('Verificando conexão com o banco do CRM e cadastro do Tagg Master...');
  try {
    const result = await runMasterBootstrap({ env: process.env, store, prompt: process.stdin.isTTY ? ask : undefined, checkOnly: process.argv.includes('--check') });
    if (result.status === 'exists') console.info('Já existe um Tagg Master. Use /taggmaster com as credenciais cadastradas. Nenhum dado foi alterado.');
    else if (result.status === 'missing') console.info('Conexão e consulta concluídas. Ainda não existe Tagg Master. Execute npm run master:bootstrap para cadastrar.');
    else console.info('Tagg Master criado. Acesse /taggmaster com as credenciais informadas.');
  } finally { prompt?.close(); output?.end(); }
}
bootstrapMaster().catch(error => { console.error(formatBootstrapError(error)); process.exitCode = 1; });
