import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeInvestigationMemory} from '../src/memory.ts';
import {parseCSV,reconcile} from '../src/core.mjs';
import {demo} from '../src/fixtures.mjs';
test('real Meterless H-MEM captures provenance, retrieves a recorded finding and audits recall',()=>{
  const source=Object.fromEntries(['orders','settlements','refunds'].map(k=>[k,parseCSV(demo[k],k)]));
  const context=makeInvestigationMemory(reconcile(source,demo));
  const response=context.recall('Explain the shortfall in order A-1002');
  assert.equal(response.findings[0].finding.difference,1000);
  const stored=context.memory.store.all().find(r=>r.source==='recorded-finding:orders:A-1002');
  assert.ok(stored?.provenance.refs?.includes('settlements.csv:3'));
  assert.ok(response.ledger.some(e=>e.action==='create'));
  assert.ok(response.context.length>0);
  context.memory.feedback(stored!.id,'wrong');
  assert.equal(context.memory.store.get(stored!.id)?.confidence,0.8);
  assert.ok(context.memory.ledger.history(stored!.id).some(e=>e.action==='feedback'));
});

test('exact reference lookup never matches a prefix inside a longer identifier',()=>{
  const source=Object.fromEntries(['orders','settlements','refunds'].map(k=>[k,parseCSV(demo[k],k)]));
  const context=makeInvestigationMemory(reconcile(source,demo));
  assert.equal(context.recall('Explain A-100').mode,'hmem-retrieval');
  const exact=context.recall('Explain (A-1002).');
  assert.equal(exact.mode,'exact-id-tool');assert.equal(exact.findings.length,1);assert.equal(exact.findings[0].finding.id,'A-1002');
});
