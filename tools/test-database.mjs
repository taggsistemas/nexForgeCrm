import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { spawn } from 'node:child_process';
import { resolve, relative, isAbsolute } from 'node:path';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
const root = resolve(import.meta.dirname, '..');
let replica, child, databasePath;
let stopping;
let interrupted = false;
async function stop() {
  stopping ??= (async () => {
    if (child && child.exitCode === null) child.kill('SIGTERM');
    if (replica) await replica.stop({doCleanup:true,force:false});
    if(databasePath){const rel=relative(resolve(root,'artifacts'),databasePath);if(rel && !rel.startsWith('..') && !isAbsolute(rel)) await rm(databasePath,{recursive:true,force:true});}
  })();
  return stopping;
}
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => {
  interrupted=true;
  stop().finally(()=>{process.exitCode=130;});
});
try {
  console.info('Iniciando MongoDB local temporário, exclusivo dos testes (replica set em 127.0.0.1).');
  await mkdir(resolve(root,'artifacts'),{recursive:true});
  databasePath=await mkdtemp(resolve(root,'artifacts/mongo-instance-'));
  replica = new MongoMemoryReplSet({
    instanceOpts:[{dbPath:databasePath}],
    binary:{version:'8.0.17',downloadDir:resolve(root,'artifacts/mongodb-binaries')},
    replSet:{count:1,ip:'127.0.0.1',name:'crm_test_rs',storageEngine:'wiredTiger',spawn:{windowsHide:true}},
  });
  await replica.start();
  if (!interrupted) {
    const env={...process.env,MONGODB_TEST_URI:replica.getUri(),CRM_REQUIRE_TEST_DB:'true'};
    delete env.MONGODB_URI;
    console.info('MongoDB de testes pronto. Executando integração real; o .env da aplicação não é carregado.');
    const code=await new Promise((resolveCode,reject)=>{
      child=spawn(process.execPath,[resolve(root,'node_modules/vitest/vitest.mjs'),'run','tests/integration/identity-mongo.test.ts','tests/integration/platform-mongo.test.ts','tests/integration/administration-mongo.test.ts','tests/integration/relationships-mongo.test.ts','tests/integration/account-security-mongo.test.ts','tests/integration/opportunities-mongo.test.ts','tests/integration/agenda-mongo.test.ts','tests/integration/territories-mongo.test.ts','tests/integration/field-visits-mongo.test.ts','tests/integration/licensing-mongo.test.ts','tests/integration/offline-mongo.test.ts','tests/integration/catalog-mongo.test.ts','tests/integration/technical-mongo.test.ts','tests/integration/customer-profile-mongo.test.ts','tests/integration/properties-mongo.test.ts','tests/integration/equipment-mongo.test.ts','tests/integration/proposals-mongo.test.ts','tests/integration/attendances-mongo.test.ts','tests/integration/tickets-mongo.test.ts','tests/integration/work-orders-mongo.test.ts','tests/integration/work-order-parts-mongo.test.ts','tests/integration/indicators-mongo.test.ts'],{cwd:root,env,stdio:'inherit',windowsHide:true});
      child.once('error',reject); child.once('exit',code=>resolveCode(code ?? 1));
    });
    process.exitCode=Number(code);
  }
} catch {
  console.error('Não foi possível executar o MongoDB de testes. Verifique download do binário oficial e permissão de execução local. O banco da aplicação não foi utilizado.');
  process.exitCode=1;
} finally {
  await stop();
  console.info('Ambiente MongoDB temporário encerrado.');
}

