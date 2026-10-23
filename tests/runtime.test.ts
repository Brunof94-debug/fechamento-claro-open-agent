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
    return new Response(JSON.stringify({model:'local-test',choices:[{message:{content:'ok'}}],meterless:{winning_route:{kind:'local'},privacy:{path:'local-only'}}}),{status:200});
  }});
  assert.equal((await client.chat([{role:'user',content:'test'}])).content,'ok');
});
test('investigator rejects unavailable tool choices and only returns inspected source findings',async()=>{
  const sources=Object.fromEntries(['orders','settlements','refunds'].map(k=>[k,parseCSV(demo[k],k)]));
  const close={result:reconcile(sources,demo),zetaris:{executed:true}};
  const actions=[{choice:999},{choice:0},{choice:0},{choice:0}];
  const result=await investigate('Why A-1002?',close,{chat:async()=>({content:JSON.stringify(actions.shift()),receipt:{test:true}})});
  assert.equal(result.trace[0].type,'invalid_model_output');assert.equal(result.findings[0].difference,1000);
  assert.ok(result.trace.some(row=>row.tool==='Meterless H-MEM'));
  assert.ok(result.findings[0].evidence.some((row:any)=>row.file==='settlements.csv'&&row.line===3));
  assert.deepEqual(result.findings[0].nextChecks,['request_processor_statement','check_fee_contract']);
  const wrongChoices=[{choice:2},{choice:0},{choice:0}];
  await assert.rejects(()=>investigate('Why A-1002?',close,{chat:async()=>({content:JSON.stringify(wrongChoices.shift()),receipt:{test:true}})}),/No retrieved case|did not complete/);
});

test('a cloud or unconfirmed winning route cannot become an accepted local conclusion',async()=>{
  const client=new Nightshift({token:'test-only',fetchImpl:async()=>new Response(JSON.stringify({model:'cloud-test',choices:[{message:{content:'ok'}}],meterless:{winning_route:{kind:'cloud'},privacy:{path:'cloud'}}}),{status:200})});
  await assert.rejects(()=>client.chat([{role:'user',content:'fictional test'}]),{code:'non-local'});
});
