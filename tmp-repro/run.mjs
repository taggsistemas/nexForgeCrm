import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const r=new MongoMemoryReplSet({binary:{version:'8.0.17',downloadDir:resolve('artifacts/mongodb-binaries')},replSet:{count:1,ip:'127.0.0.1',storageEngine:'wiredTiger'}});
await r.start();
const env={...process.env,MONGODB_TEST_URI:r.getUri(),CRM_REQUIRE_TEST_DB:'true'};delete env.MONGODB_URI;
const code=await new Promise(ok=>spawn(process.execPath,[resolve('node_modules/vitest/vitest.mjs'),'run',...process.argv.slice(2)],{env,stdio:'inherit'}).once('exit',ok));
await r.stop();process.exitCode=code;
