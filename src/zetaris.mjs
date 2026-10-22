import {readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual} from 'node:util';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {schemas,reconcile} from './core.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const runFile=promisify(execFile);

// Keep source registration and queries in one authenticated Zetaris JDBC session.
// The official REST SELECT route cannot register sources.
export async function loadZetarisClose(staged,options) {
  for(const table of Object.values(staged.tables)) {
    if(!/^fc_[a-f0-9]{32}_(orders|settlements|refunds)$/.test(table.name)||!/^\/home\/zetaris\/customer-data\/shared\/fechamento\/fc_[a-f0-9]{32}\/(orders|settlements|refunds)\.csv$/.test(table.path))throw new Error('Invalid private staging table.');
  }
  const independent=reconcile(staged.sources,options);
  const o='FECHAMENTO_CLARO.'+staged.tables.orders.name,p='FECHAMENTO_CLARO.'+staged.tables.settlements.name,r='FECHAMENTO_CLARO.'+staged.tables.refunds.name,cutoff=independent.cutoff;
  const sql=`WITH payments AS (SELECT order_id, SUM(CAST(net_cents AS BIGINT)) AS paid FROM ${p} WHERE posted_date <= '${cutoff}' GROUP BY order_id), refunds AS (SELECT order_id, SUM(CAST(refund_cents AS BIGINT)) AS refunded FROM ${r} WHERE posted_date <= '${cutoff}' GROUP BY order_id), duplicate_orders AS (SELECT order_id FROM ${o} GROUP BY order_id HAVING COUNT(*) > 1), duplicate_payments AS (SELECT txn_id FROM ${p} GROUP BY txn_id HAVING COUNT(*) > 1), duplicate_refunds AS (SELECT refund_id FROM ${r} GROUP BY refund_id HAVING COUNT(*) > 1) SELECT o.order_id, CAST(o.gross_cents AS BIGINT) - CAST(o.fee_cents AS BIGINT) - COALESCE(r.refunded,0) AS expected_cents, COALESCE(p.paid,0) AS observed_cents FROM ${o} o LEFT JOIN payments p ON o.order_id=p.order_id LEFT JOIN refunds r ON o.order_id=r.order_id WHERE o.order_id NOT IN (SELECT order_id FROM duplicate_orders) AND o.order_id NOT IN (SELECT order_id FROM ${p} WHERE txn_id IN (SELECT txn_id FROM duplicate_payments)) AND o.order_id NOT IN (SELECT order_id FROM ${r} WHERE refund_id IN (SELECT refund_id FROM duplicate_refunds)) ORDER BY o.order_id`;
  const stagedPath=resolve(root,'.runtime',staged.run+'-staged.json');
  await writeFile(stagedPath,JSON.stringify({...staged,crossSourceSQL:sql}),'utf8');
  await runFile(process.env.FECHAMENTO_PYTHON||'python',[resolve(root,'scripts/register-zetaris-sources.py'),stagedPath],{cwd:root,timeout:180000,maxBuffer:128000});
  const queries=JSON.parse(await readFile(resolve(root,'.runtime',staged.run+'-query-results.json'),'utf8'));
  const source={};
  for(const kind of Object.keys(schemas)) {
    source[kind]=queries.sources[kind].map(record=>{
      const row=Object.fromEntries(schemas[kind].map(key=>[key,key.endsWith('_cents')?Number(record[key]):record[key]]));
      row.evidence=JSON.parse(Buffer.from(record.evidence_b64,'base64').toString('utf8'));
      if(record.source_sha256!==staged.manifest[kind].sha256TextUTF8 || Number(record.source_line)!==row.evidence.line)throw new Error('Zetaris source provenance does not match the staged snapshot.');
      return row;
    });
    if(!isDeepStrictEqual(source[kind],staged.sources[kind]))throw new Error('Zetaris source rows differ from the validated snapshot.');
  }
  const result=reconcile(source,options);
  for(const finding of result.cases.filter(row=>row.expected!==undefined)) {
    const row=queries.joined.find(row=>row.order_id===finding.id);
    if(!row||Number(row.expected_cents)!==finding.expected||Number(row.observed_cents)!==finding.observed)throw new Error('Zetaris and the independent integer-cent check disagree. No explanation was generated.');
  }
  return {result,sources:source,manifest:staged.manifest,zetaris:{executed:true,method:'official Zetaris JDBC',run:staged.run,checks:'Every source row and counted SQL total matched the independent cent calculation.',receipts:queries.receipts,joined:queries.joined}};
}
