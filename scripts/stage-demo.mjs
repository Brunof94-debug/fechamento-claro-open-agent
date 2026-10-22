import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {demo} from '../src/fixtures.mjs';
import {schemas} from '../src/core.mjs';
import {stageSources} from '../src/staging.mjs';

await mkdir('.runtime/zetaris-data',{recursive:true});
const envPath='.runtime/zetaris/zetaris-platform/.env';
let env=await readFile(envPath,'utf8');
const entry='FECHAMENTO_DATA_DIR='+resolve('.runtime/zetaris-data').replaceAll('\\','/');
env=/^FECHAMENTO_DATA_DIR=.*$/m.test(env)?env.replace(/^FECHAMENTO_DATA_DIR=.*$/m,entry):env+'\n'+entry+'\n';
await writeFile(envPath,env,'utf8');
const staged=await stageSources(Object.fromEntries(Object.keys(schemas).map(kind=>[kind,{name:kind+'.csv',text:demo[kind]}])));
await writeFile('.runtime/demo-staged.json',JSON.stringify(staged,null,2),'utf8');
console.log(JSON.stringify({run:staged.run,manifest:staged.manifest,credentialsExposed:false},null,2));
