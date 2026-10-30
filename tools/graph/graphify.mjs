#!/usr/bin/env node
// Runs the pinned Graphify CLI from the project venv (tools/graph/.venv), so agents and hooks never depend on PATH.
// `--setup` creates the venv and installs the exact version from requirements.txt.
// Hooks call `hook-guard`: when Graphify is not installed on this machine they exit 0 silently instead of failing every tool call.
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),venv=join(here,'.venv'),windows=process.platform==='win32';
const bin=(name)=>join(venv,windows?'Scripts':'bin',windows?name+'.exe':name);
const run=(command,args)=>spawnSync(command,args,{stdio:'inherit',cwd:join(here,'..','..')}).status??1;
const args=process.argv.slice(2);
if(args[0]==='--setup'){
 const python=process.env.PYTHON??(windows?'python':'python3');
 if(!existsSync(bin('python'))&&run(python,['-m','venv',venv])!==0)process.exit(1);
 process.exit(run(bin('python'),['-m','pip','install','--disable-pip-version-check','-r',join(here,'requirements.txt')]));
}
if(!existsSync(bin('graphify'))){
 if(args[0]==='hook-guard')process.exit(0);
 console.error('Graphify não está instalado neste computador. Rode: npm run graph:install');process.exit(127);
}
process.exit(run(bin('graphify'),args));
