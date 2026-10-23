import {demo} from './fixtures.mjs';
import {parseCSV,reconcile,schemas} from './core.mjs';
import {makeInvestigationMemory} from './memory.ts';
const $=(selector:string)=>document.querySelector(selector) as any;
const esc=(s:any)=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));
let lang='en', selected='', result:any=null, notebook:any=null;
let live=false,liveClose:any=null,liveAnswer:any=null,runtimeState='not-configured',working=false;
let loaded:Record<string,any>={};
const dictionary:any={
  pt:{private:'Arquivos ficam nesta aba',eyebrow:'O FECHAMENTO DO PEQUENO NEGÓCIO, EXPLICADO',title:'Siga a diferença.<br>Encontre o motivo.',intro:'Os pedidos dizem uma coisa. Os recebimentos, outra.<br>Reúna os registros e confira o que cada centavo explica.',sources:'01 / SUAS FONTES',bring:'Reúna os três lados.',sourceHint:'Arquivos CSV, até 2 MB e 5.000 linhas cada. Valores em centavos inteiros e uma moeda por fechamento.',closing:'Data do fechamento',currency:'Moeda',investigate:'Investigar o fechamento ↗',example:'Experimentar o exemplo fictício',format:'Ver as colunas exigidas',mode:'Prévia com arquivos locais. A conexão Zetaris está em preparação. Nenhum modelo generativo está ativo.',evidenceFirst:'PRIMEIRO A EVIDÊNCIA. DEPOIS A EXPLICAÇÃO.',emptyTitle:'Um fechamento claro começa<br>com a visão completa.',emptyText:'Adicione pedidos, recebimentos e estornos, ou experimente o exemplo fictício. O conteúdo dos arquivos não é enviado a um servidor.',step1:'Ler as fontes',step2:'Conferir os centavos',step3:'Inspecionar a evidência',reportLabel:'02 / A INVESTIGAÇÃO',reportTitle:'O que os registros mostram.',export:'Exportar evidências ↓',order:'Pedido / referência',expected:'Esperado',received:'Recebido',difference:'Diferença',status:'Situação',memoryLabel:'03 / RETOME UMA CONCLUSÃO',memoryTitle:'Consulte o caderno de evidências.',memoryHint:'O Meterless H-MEM recupera resultados registrados pelas regras. Referências exatas abrem o registro correspondente. Esta é uma busca, sem explicação gerada por modelo.',recall:'Buscar evidências',footer:'Uma divergência é uma pergunta a investigar, não a prova de um erro.'}
};
const english:Record<string,string>={};
document.querySelectorAll('[data-i]').forEach((node:any)=>english[node.dataset.i]=node.innerHTML);
const names:any={en:{orders:'Orders',settlements:'Settlements',refunds:'Refunds'},pt:{orders:'Pedidos',settlements:'Recebimentos',refunds:'Estornos'}};
const labels:any={en:{matched:'Explained',shortfall:'Shortfall',surplus:'Surplus',unsettled:'Not received',pending:'Not due yet',review:'Source review'},pt:{matched:'Explicado',shortfall:'A menor',surplus:'A maior',unsettled:'Não recebido',pending:'Ainda a vencer',review:'Revisar fonte'}};
const t=(en:string,pt:string)=>lang==='pt'?pt:en;
const money=(amount:any)=>amount===undefined?'—':new Intl.NumberFormat(lang==='pt'?'pt-BR':'en-US',{style:'currency',currency:result?.currency||$('#currency').value}).format(amount/100);
function renderSources(){
  $('#sources').innerHTML=Object.keys(schemas).map(kind=>`<label class="source"><span>${loaded[kind]?'✓':'+'}</span><strong>${names[lang][kind]}</strong><small>${esc(loaded[kind]?.name||t('Choose a CSV','Escolher CSV'))}</small><input type="file" data-source="${kind}" accept=".csv,text/csv" aria-label="${names[lang][kind]} CSV" ${working?'disabled':''}></label>`).join('');
  $('#investigate').disabled=working||!Object.keys(schemas).every(k=>loaded[k]);
  for(const id of ['example','cutoff','currency'])$('#'+id).disabled=working;
}
function updateMode(){
  const state=t(({online:'assistant connected locally',offline:'assistant offline',unauthorized:'assistant connection needs renewal','not-configured':'assistant connection pending',unavailable:'assistant unavailable'} as any)[runtimeState]||runtimeState,({online:'assistente conectado localmente',offline:'assistente fora do ar',unauthorized:'a conexão do assistente precisa ser renovada','not-configured':'conexão do assistente pendente',unavailable:'assistente indisponível'} as any)[runtimeState]||runtimeState);
  $('[data-i="private"]').textContent=live?t('Processing on this computer','Processamento neste computador'):t('Files stay in this tab','Arquivos ficam nesta aba');
  $('[data-i="mode"]').textContent=live?t(`${liveClose?'Zetaris read the sources and the amounts passed the independent check.':'Local workspace. Sources go through Zetaris when you investigate.'} Nightshift: ${state}.`,`${liveClose?'O Zetaris leu as fontes e os valores passaram pela conferência independente.':'Espaço local. As fontes passam pelo Zetaris ao investigar.'} Nightshift: ${state}.`):t('Browser preview · rule checks and evidence search. Run the local workspace for Zetaris and the Nightshift investigator.','Prévia no navegador · conferência por regras e busca de evidências. Execute o espaço local para usar Zetaris e o investigador Nightshift.');
  $('[data-i="emptyText"]').textContent=live?t('Try the fictional example. Source files are processed by Zetaris on this computer. Questions use the local Nightshift model.','Experimente o exemplo fictício. O Zetaris processa os arquivos neste computador. As perguntas usam o modelo local do Nightshift.'):t('Add the three sources, or try the fictional example. File contents are processed in this tab.','Adicione as três fontes ou use o exemplo fictício. O conteúdo dos arquivos é processado nesta aba.');
  $('[data-i="memoryHint"]').textContent=live?t('The investigator selects evidence tools through Nightshift. Every accepted finding links to inspected source rows. Amounts come from checked rules; source truth is not independently verified.','O investigador seleciona ferramentas de evidência pelo Nightshift. Cada conclusão aceita aponta para linhas inspecionadas. Os valores vêm de regras conferidas; a veracidade das fontes não é auditada.'):t('Meterless H-MEM retrieves recorded rule results. Exact references open the matching record. This preview uses evidence search.','O Meterless H-MEM recupera resultados registrados pelas regras. Referências exatas abrem o registro correspondente. Esta prévia usa busca de evidências.');
  $('[data-i="recall"]').textContent=working?t('Working…','Processando…'):live?t('Investigate question','Investigar pergunta'):t('Find evidence','Buscar evidências');
  $('#ask button').disabled=working;
  $('#refresh').hidden=!live;$('#refresh').disabled=working;$('#refresh').textContent=t('Check assistant connection','Conferir a conexão do assistente');
}
async function api(path:string,input:any){
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'The local request failed.');return data;
}
function explain(row:any){
  if(lang==='en')return row.reason;
  if(row.status==='review')return t(row.reason,row.reason.startsWith('Duplicate')?'Há identificadores repetidos. Resolva os registros antes de somar este pedido.':row.reason.includes('exceed')?'Estornos e taxas excedem o valor do pedido. Confira os registros.':'Não há pedido correspondente. Forneça o registro que falta antes de somar.');
  return ({matched:row.refunds?'O estorno e a taxa informada explicam o recebimento líquido.':row.evidence.filter((r:any)=>r.source==='settlements').length>1?'Os recebimentos parciais somam o líquido esperado.':'A taxa informada explica a diferença entre o bruto e o líquido.',pending:row.observed>0?'Houve recebimento parcial. O saldo ainda não venceu neste fechamento; confira novamente na data contratual.':'O vencimento contratual está depois deste fechamento. O saldo ainda não venceu.',unsettled:'O vencimento passou; não há recebimento lançado até a data deste fechamento nas fontes.',shortfall:'O valor recebido é menor que o esperado após taxas e estornos informados. A causa ainda não foi comprovada.',surplus:'O valor recebido excede o líquido esperado. Confira o contrato e as fontes.'} as any)[row.status];
}
function evidenceRows(rows:any[],excluded=false){return rows.map((e:any)=>`<div class="evidence-row"><strong>${esc(e.file)}:${e.line}${excluded?` · ${t('AFTER CLOSE — excluded','APÓS O FECHAMENTO — excluída')}`:''}</strong><code>${esc(e.columns.join(' | '))}</code><code>${esc(e.raw.join(' | '))}</code></div>`).join('');}
function showDetail(id:string){
  selected=id;const row=result.cases.find((r:any)=>r.key===id);if(!row)return;
  $('#detail').innerHTML=`<section class="detail"><h3>${esc(row.id)} · ${labels[lang][row.status]}</h3><p>${esc(explain(row))}</p>${row.expected!==undefined?`<div class="equation">${money(row.gross)} − ${money(row.fee)} − ${money(row.refunds)} = ${money(row.expected)} ${t('expected','esperado')}<br>${money(row.expected)} − ${money(row.observed)} = <strong>${money(row.difference)}</strong> ${t('difference','de diferença')}</div>`:''}<p><strong>${t('Source evidence','Evidências de origem')}</strong> · ${t('physical CSV line numbers; source records are not independently verified','linhas físicas do CSV; a veracidade das fontes não é verificada')}</p>${evidenceRows(row.evidence)}${row.excludedFutureRows?.length?`<p><strong>${t('Later postings — excluded from arithmetic','Lançamentos posteriores — excluídos do cálculo')}</strong></p>${evidenceRows(row.excludedFutureRows,true)}`:''}</section>`;
}
function renderReport(){
  if(!result)return;
  $('#empty').hidden=true;$('#report').hidden=false;
  $('#stats').innerHTML=`<div class="stat"><small>${t('Open differences, due','Diferenças vencidas')}</small><b>${money(result.summary.unexplained)}</b></div><div class="stat"><small>${t('Orders explained','Pedidos explicados')}</small><b>${result.summary.matched} <small>/ ${result.summary.orders}</small></b></div><div class="stat"><small>${t('Source reviews','Revisões de fonte')}</small><b>${result.summary.review}</b></div>`;
  $('#notice').textContent=t(`Close as of ${result.cutoff}. ${result.summary.pending} not yet due. Review cases are excluded from totals. A shortfall does not establish its cause.`,`Fechamento em ${result.cutoff}. ${result.summary.pending} ainda a vencer. Casos em revisão ficam fora dos totais. Uma diferença não comprova sua causa.`);
  $('#rows').innerHTML=result.cases.map((r:any)=>`<tr><td><button data-case="${esc(r.key)}" aria-label="${t('Inspect','Inspecionar')} ${esc(r.id)}">${esc(r.id)}</button></td><td>${money(r.expected)}</td><td>${money(r.observed)}</td><td>${money(r.difference)}</td><td><span class="badge ${r.status}">${labels[lang][r.status]}</span></td></tr>`).join('');
  if(selected)showDetail(selected);
}
$('#language').onclick=()=>{
  lang=lang==='en'?'pt':'en';document.documentElement.lang=lang;$('#language').textContent=lang==='pt'?'EN':'PT';
  document.querySelectorAll('[data-i]').forEach((node:any)=>node.innerHTML=lang==='pt'?dictionary.pt[node.dataset.i]:english[node.dataset.i]);
  $('#question').placeholder=t('Explain the shortfall in A-1002','Explique a diferença em A-1002');
  renderSources();renderReport();updateMode();$('#answer').textContent='';
};
$('#sources').addEventListener('change',async(event:any)=>{
  const input=event.target,file=input.files?.[0],kind=input.dataset.source;if(!file||!kind)return;
  try{
    if(file.size>2_000_000)throw new Error(t('A source exceeds 2 MB.','Uma fonte excede 2 MB.'));
    const text=await file.text();const rows=parseCSV(text,kind,file.name);
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    loaded[kind]={name:file.name,text,rows,sha256:[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('')};
    result=null;notebook=null;liveClose=null;liveAnswer=null;$('#report').hidden=true;$('#empty').hidden=false;$('#error').textContent='';renderSources();
  }catch(error:any){delete loaded[kind];result=null;notebook=null;$('#report').hidden=true;$('#empty').hidden=false;$('#error').textContent=error.message;renderSources();}
});
$('#example').onclick=async()=>{
  loaded={};for(const kind of Object.keys(schemas)){
    const text=(demo as any)[kind],name=`${kind}.csv`;
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    loaded[kind]={name,text,rows:parseCSV(text,kind,name),sha256:[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('')};
  }
  $('#cutoff').value=demo.cutoff;$('#currency').value=demo.currency;$('#error').textContent='';result=null;notebook=null;$('#report').hidden=true;$('#empty').hidden=false;renderSources();
};
$('#investigate').onclick=async()=>{
  if(working)return;working=true;renderSources();updateMode();$('#error').textContent=t('Reading and checking the sources…','Lendo e conferindo as fontes…');
  try{
    liveClose=null;liveAnswer=null;
    if(live){
      liveClose=await api('/api/close',{files:Object.fromEntries(Object.keys(schemas).map(k=>[k,{name:loaded[k].name,text:loaded[k].text}])),cutoff:$('#cutoff').value,currency:$('#currency').value});
      result=liveClose.result;
    }else result=reconcile(Object.fromEntries(Object.keys(schemas).map(k=>[k,loaded[k].rows])),{cutoff:$('#cutoff').value,currency:$('#currency').value});
    notebook=makeInvestigationMemory(result);selected='';$('#answer').textContent='';$('#detail').textContent='';$('#error').textContent='';
    renderReport();
  }catch(error:any){result=null;notebook=null;liveClose=null;$('#report').hidden=true;$('#empty').hidden=false;$('#error').textContent=error.message;}
  finally{working=false;renderSources();updateMode();}
};
for(const id of ['cutoff','currency'])$('#'+id).addEventListener('change',()=>{result=null;notebook=null;liveClose=null;liveAnswer=null;$('#report').hidden=true;$('#empty').hidden=false;});
$('#rows').onclick=(event:any)=>{const button=event.target.closest('[data-case]');if(button)showDetail(button.dataset.case);};
$('#ask').onsubmit=async(event:any)=>{
  event.preventDefault();if(!notebook||working)return;
  if(live){
    working=true;renderSources();updateMode();$('#answer').textContent=t('Nightshift is selecting and inspecting evidence. A cold model can take a few minutes.','O Nightshift está selecionando e inspecionando evidências. A primeira execução pode levar alguns minutos.');
    try{
      liveAnswer=await api('/api/ask',{run:liveClose.run,question:$('#question').value});
      runtimeState='online';
      const checkNames:any={request_processor_statement:t('Request the processor statement','Solicitar o extrato da operadora'),check_fee_contract:t('Check the fee contract','Conferir o contrato de taxas'),check_settlement_schedule:t('Check the settlement schedule','Conferir o prazo de recebimento'),resolve_source_conflict:t('Resolve the source conflict','Resolver o conflito da fonte'),recheck_on_due_date:t('Recheck on the contractual due date','Conferir na data contratual'),retain_source_rows:t('Retain the cited records','Guardar os registros citados')};
      $('#answer').innerHTML=liveAnswer.findings.map((finding:any)=>`<p><strong>${esc(finding.id)}</strong> · ${esc(explain(finding))} ${finding.difference===undefined?'':`<b>${money(finding.difference)}</b>`}<br><small>${finding.evidence.map((row:any)=>esc(`${row.file}:${row.line}`)).join(' · ')}</small><br>${t('Next check:','Próxima conferência:')} ${finding.nextChecks.map((check:string)=>esc(checkNames[check]||check)).join('; ')} <button class="quiet" data-case="${esc(finding.key)}">${t('Inspect rows','Ver linhas')}</button></p>`).join('')+`<details><summary>${t('View tool trail and model receipts','Ver ferramentas e comprovantes do modelo')}</summary><pre>${esc(JSON.stringify({trace:liveAnswer.trace,receipts:liveAnswer.receipts,policy:liveAnswer.explanationPolicy},null,2))}</pre></details>`;
    }catch(error:any){liveAnswer=null;$('#answer').textContent=error.message;}
    finally{working=false;renderSources();updateMode();}return;
  }
  const answer=notebook.recall($('#question').value);
  $('#answer').innerHTML=answer.findings.length?answer.findings.map(({finding}:any)=>`<p><strong>${esc(finding.id)}</strong> · ${esc(explain(finding))} ${finding.difference===undefined?'':`<b>${money(finding.difference)}</b>`} <button class="quiet" data-case="${esc(finding.key)}">${t('Inspect rows','Ver linhas')}</button></p>`).join(''):`<p>${t('No sufficiently relevant finding. Try an exact order reference.','Nenhuma conclusão suficientemente relevante. Tente a referência exata do pedido.')}</p>`;
  $('#answer').innerHTML+=`<details><summary>${t('View retrieval trace','Ver rastro da busca')}</summary><pre>${esc(JSON.stringify({engine:'Meterless H-MEM',mode:answer.mode,trace:answer.trace,auditEntries:answer.ledger.length},null,2))}</pre></details>`;
};
$('#answer').onclick=(event:any)=>{const button=event.target.closest('[data-case]');if(button)showDetail(button.dataset.case);};
$('#export').onclick=()=>{
  if(!result)return;
  const packet={...result,generatedAt:new Date().toISOString(),sourceMode:liveClose?'zetaris-local-jdbc':'browser-csv-preview',generativeModel:!!liveAnswer?.modelUsed,integrations:{meterless:liveAnswer?'Nightshift local Runtime + H-MEM':'H-MEM reference in-memory; no model used',zetaris:liveClose?.zetaris||'not connected in browser preview'},sources:liveClose?.manifest||Object.fromEntries(Object.keys(loaded).map(k=>[k,{name:loaded[k].name,sha256TextUTF8:loaded[k].sha256}])),investigation:liveAnswer,ledger:notebook.memory.ledger.all()};
  const url=URL.createObjectURL(new Blob([JSON.stringify(packet,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`clear-close-${result.cutoff}.json`;link.click();URL.revokeObjectURL(url);
};
$('#schema').textContent=Object.entries(schemas).map(([kind,columns]:any)=>`${kind}.csv\n${columns.join(',')}`).join('\n\n');
renderSources();
updateMode();
async function refreshConnection(){await fetch('./api/status').then(async response=>{
  if(!response.ok)return;const status=await response.json();if(status.live){live=true;runtimeState=status.nightshift.state;updateMode();}
}).catch(()=>{});}
$('#refresh').onclick=refreshConnection;
refreshConnection();
