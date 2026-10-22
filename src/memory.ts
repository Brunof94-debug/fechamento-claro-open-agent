import {HMEM} from '../third-party/meterless-hmem/src/index.ts';

// Actual upstream H-MEM services, in-memory for this browser workspace.
// No filesystem, cloud model or persistent storage is represented as active.
export function makeInvestigationMemory(result:any) {
  const memory=new HMEM({actor:'clear-close'});
  memory.add({content:result.policy,type:'factual',source:'closing-policy:explicit',confidence:1,tags:['project:clear-close','accounting'],layer:'working'});
  const mappings=new Map<string,any>();
  for(const finding of result.cases) {
    const statement=`Order or transaction ${finding.id}. Status ${finding.status}. ${finding.reason} ${finding.expected===undefined?'Amounts not counted pending source review.':`Gross ${finding.gross} cents; stated fees ${finding.fee} cents; posted refunds ${finding.refunds} cents; expected ${finding.expected} cents; received ${finding.observed} cents; difference ${finding.difference} cents.`}`;
    const refs=finding.evidence.map((r:any)=>`${r.file}:${r.line}`);
    const record=memory.add({content:statement,type:'factual',source:`recorded-finding:${finding.key}`,confidence:1,tags:['project:clear-close',finding.id,finding.status],layer:'working',provenance:{origin:'document',learnedAt:Date.now(),label:'Rule result from cited rows; sources not independently verified',refs}});
    mappings.set(record.id,finding);
  }
  return {
    memory,
    recall(query:string) {
      const found=memory.query(query,{topN:5,threshold:0.1});
      const exact=[...mappings].filter(([,r])=>new RegExp(`(?:^|[^A-Z0-9_-])${r.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=$|[^A-Z0-9_-])`,'i').test(query));
      // Exact identifiers are an explicit tool lookup, not semantic recall.
      return {trace:found.trace, context:found.context, mode:exact.length?'exact-id-tool':'hmem-retrieval', findings:exact.length?exact.map(([memoryId,finding])=>({memoryId,finding})):found.memories.filter(r=>mappings.has(r.memory.id)).map(r=>({memoryId:r.memory.id,finding:mappings.get(r.memory.id),relevance:r.relevance})), ledger:memory.ledger.all()};
    }
  };
}
