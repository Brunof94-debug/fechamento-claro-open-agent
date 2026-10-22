import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cents,parseCSV,reconcile} from '../src/core.mjs';
import {demo} from '../src/fixtures.mjs';
const load=()=>Object.fromEntries(['orders','settlements','refunds'].map(k=>[k,parseCSV(demo[k],k)]));
const update=(row:any,key:string,value:any)=>{row[key]=value;row.evidence.raw[row.evidence.columns.indexOf(key)]=String(value);};
test('fictional close keeps split payments and refunds and separates pending/review',()=>{
  const result=reconcile(load(),demo);
  assert.deepEqual(result.summary,{orders:7,matched:3,review:2,pending:1,unexplained:12640,expected:66870,observed:48410,expectedDue:61050,observedDue:48410,expectedNotDue:5820,observedNotDue:0});
  assert.equal(result.cases.find(r=>r.id==='A-1003')?.observed,14550);
  assert.equal(result.cases.find(r=>r.id==='A-1004')?.refunds,2000);
  assert.equal(result.cases.find(r=>r.id==='A-1006')?.expected,undefined);
});
test('one cent changed in a source changes the difference by exactly one cent',()=>{
  const sources=load(); const before=reconcile(sources,demo).cases.find(r=>r.id==='A-1002');
  const payment=sources.settlements.find(r=>r.order_id==='A-1002');update(payment,'net_cents',payment.net_cents+1);
  const after=reconcile(sources,demo).cases.find(r=>r.id==='A-1002');
  assert.equal(before.difference-after.difference,1);
});
test('future posting is excluded as of close and becomes matched on its posting date',()=>{
  const sources=load();
  assert.equal(reconcile(sources,demo).cases.find(r=>r.id==='A-1007')?.status,'pending');
  assert.equal(reconcile(sources,{...demo,cutoff:'2026-10-22'}).cases.find(r=>r.id==='A-1007')?.status,'matched');
});
test('duplicate IDs across different orders quarantine both orders',()=>{
  const sources=load(); update(sources.settlements[1],'txn_id',sources.settlements[0].txn_id);
  const result=reconcile(sources,demo);
  assert.ok(['A-1001','A-1002'].every(id=>result.cases.find(r=>r.id===id)?.status==='review'));
});
test('mixed currencies cannot be accidentally totalled',()=>{
  const sources=load();update(sources.settlements[0],'currency','USD');
  assert.throws(()=>reconcile(sources,demo),/Mixed currencies/);
});
test('strict cents reject floats, exponents, negatives and unsafe limits',()=>{
  for(const value of ['1.01','1e5','-1','NaN','100000000001']) assert.throws(()=>cents(value));
  assert.equal(cents('0001'),1);
});
test('CSV supports quoted fields, CRLF and a BOM and retains physical source line',()=>{
  const rows=parseCSV('\uFEFForder_id,gross_cents,fee_cents,currency,due_date\r\n"A-1",1000,30,BRL,2026-10-20\r\n','orders','orders.csv');
  assert.equal(rows[0].evidence.line,2);assert.equal(rows[0].order_id,'A-1');
  assert.throws(()=>parseCSV('order_id,order_id\nA,A','orders'),/headers/);
  assert.throws(()=>parseCSV('order_id,gross_cents,fee_cents,currency,due_date\nA,1,0,BRL,2026-02-30','orders'),/date/);
});
test('fees/refunds greater than gross are reviewed rather than creating a negative expected payout',()=>{
  const sources=load();update(sources.orders[0],'fee_cents',10001);
  assert.equal(reconcile(sources,demo).cases.find(r=>r.id==='A-1001')?.status,'review');
});

test('reconciliation refuses fractional cents and numbers inconsistent with their cited source',()=>{
  const sources=load(); sources.settlements[0].net_cents=9700.5;
  assert.throws(()=>reconcile(sources,demo),/Integer cents/);
  sources.settlements[0].net_cents=9701;
  assert.throws(()=>reconcile(sources,demo),/agree with the cited/);
});

test('future records remain visible separately and never become calculation citations',()=>{
  const sources=load();update(sources.orders.find(r=>r.order_id==='A-1007'),'due_date','2026-10-20');
  const result=reconcile(sources,demo), row=result.cases.find(r=>r.id==='A-1007');
  assert.equal(row.status,'unsettled');assert.match(row.reason,/on or before this closing date/);
  assert.ok(row.evidence.every(e=>e.source!=='settlements'));
  assert.equal(row.excludedFutureRows.length,1);
  assert.equal(result.excludedFutureRows.length,1);
});

test('partial early receipts stay not-due with explicit remaining balance and separate totals',()=>{
  const sources=load();update(sources.orders[0],'due_date','2026-11-01');update(sources.settlements[0],'net_cents',5000);
  const result=reconcile(sources,demo), row=result.cases.find(r=>r.id==='A-1001');
  assert.equal(row.status,'pending');assert.equal(row.difference,4700);assert.match(row.reason,/partial amount/);
  assert.equal(result.summary.unexplained,12640);assert.equal(result.summary.expectedNotDue,15520);assert.equal(result.summary.observedNotDue,5000);
});

test('duplicate orders count once and duplicate orphan transactions are grouped for review',()=>{
  const sources=load();sources.orders.push(structuredClone(sources.orders[0]));
  const orphan=sources.settlements.find(r=>r.order_id==='A-9999'); sources.settlements.push(structuredClone(orphan));
  const result=reconcile(sources,demo);
  assert.equal(result.summary.orders,7);
  const orphans=result.cases.filter(r=>r.key==='settlements:S-008');
  assert.equal(orphans.length,1);assert.match(orphans[0].reason,/Duplicate/);assert.equal(orphans[0].evidence.length,2);
});

test('an orphan posted after the closing date is excluded until that date',()=>{
  const sources=load();update(sources.settlements.find(r=>r.order_id==='A-9999'),'posted_date','2026-10-22');
  const before=reconcile(sources,demo);assert.ok(!before.cases.some(r=>r.key==='settlements:S-008'));
  assert.equal(before.excludedFutureRows.length,2);
  assert.ok(reconcile(sources,{...demo,cutoff:'2026-10-22'}).cases.some(r=>r.key==='settlements:S-008'));
});
