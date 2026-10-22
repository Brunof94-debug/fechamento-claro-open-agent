import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Nightshift,normalizeRuntimeURL} from '../src/nightshift.mjs';
import {investigate} from '../src/investigator.ts';
import {parseCSV,reconcile} from '../src/core.mjs';
import {demo} from '../src/fixtures.mjs';

test('runtime URL normalization confines credentials to loopback and avoids duplicate v1',()=>{
  for(const path of ['/v1','/v1/chat/completions','/v1/models','/healthz'])assert.equal(normalizeRuntimeURL('127.0.0.1:8088'+path),'http://127.0.0.1:8088/v1');
  for(const url of ['https://example.com','http://localhost.evil.test:8088','http://token@localhost:8088','http://localhost:8088/?token=x'])assert.throws(()=>normalizeRuntimeURL(url));
});
test('runtime distinguishes rejected credentials and sends local-only routing headers',async()=>{
  const denied=new Nightshift({token:'wrong',fetchImpl:async()=>new Response('{}',{status:401})});
  assert.equal((await denied.status()).state,'unauthorized');
  const client=new Nightshift({token:'test-only',fetchImpl:async(url:any,init:any)=>{
    assert.equal(init.headers['meterless-app'],'fechamento-claro');
    assert.equal(init.headers['meterless-scope'],'user');
    assert.equal(JSON.parse(init.body).model,'meterless/local');
    return new Response(JSON.stringify({model:'local-test',choices:[{message:{content:'ok'}}]}),{status:200});
  }});
  assert.equal((await client.chat([{role:'user',content:'test'}])).content,'ok');
});
test('investigator refuses unseen citations and only returns checked source findings',async()=>{
  const sources=Object.fromEntries(['orders','settlements','refunds'].map(k=>[k,parseCSV(demo[k],k)]));
  const close={result:reconcile(sources,demo),zetaris:{executed:true}};
  const actions=[{action:'finish',keys:['orders:A-1002']},{action:'inspect_case',key:'orders:A-1002'},{action:'finish',keys:['orders:A-1002']}];
  const result=await investigate('Why A-1002?',close,{chat:async()=>({content:JSON.stringify(actions.shift()),receipt:{test:true}})});
  assert.equal(result.trace[0].type,'rejected_action');assert.equal(result.findings[0].difference,1000);
  assert.ok(result.findings[0].evidence.some((row:any)=>row.file==='settlements.csv'&&row.line===3));
  assert.deepEqual(result.findings[0].nextChecks,['request_processor_statement','check_fee_contract']);
});
