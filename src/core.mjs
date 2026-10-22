export const schemas = {
  orders: ['order_id','gross_cents','fee_cents','currency','due_date'],
  settlements: ['txn_id','order_id','net_cents','currency','posted_date'],
  refunds: ['refund_id','order_id','refund_cents','currency','posted_date']
};
const idFields = {orders:'order_id', settlements:'txn_id', refunds:'refund_id'};
const isoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
export function cents(value) {
  if (!/^\d{1,12}$/.test(String(value))) throw new Error('Amounts must be non-negative integer cents.');
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount > 100_000_000_000) throw new Error('Amount exceeds the supported limit.');
  return amount;
}
export function parseCSV(text, kind, name = `${kind}.csv`) {
  if (!schemas[kind]) throw new Error('Unsupported source type.');
  if (new TextEncoder().encode(text).length > 2_000_000) throw new Error('A source exceeds 2 MB.');
  text = text.replace(/^\uFEFF/, '');
  const records = []; let cells = [], field = '', quoted = false, afterQuote = false, line = 1, start = 1;
  const endCell = () => { cells.push(field); field = ''; afterQuote = false; };
  const endRow = () => { endCell(); if (cells.some(s=>s!=='')) records.push({cells, line:start}); cells=[]; start=line+1; };
  for(let i=0;i<text.length;i++) {
    const ch=text[i];
    if(quoted) { if(ch==='"') { if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;afterQuote=true;} } else {field+=ch;if(ch==='\n')line++;} continue; }
    if(afterQuote && ![',','\n','\r'].includes(ch)) throw new Error(`Unexpected characters after quote at line ${line}.`);
    if(ch==='"') { if(field!=='') throw new Error(`Unexpected quote at line ${line}.`); quoted=true; }
    else if(ch===',') endCell();
    else if(ch==='\n') {endRow(); line++;}
    else if(ch==='\r') { if(text[i+1]!=='\n'){endRow();line++;} }
    else field+=ch;
  }
  if(quoted) throw new Error('Unclosed CSV quote.');
  if(field!=='' || cells.length || afterQuote) endRow();
  const header = records.shift()?.cells.map(s=>s.trim());
  if(!header || new Set(header).size!==header.length || schemas[kind].some(key=>!header.includes(key)) || header.some(key=>!schemas[kind].includes(key))) throw new Error(`${name}: use the required ${kind} column headers.`);
  if(records.length>5000) throw new Error('A source exceeds 5,000 records.');
  return records.map(({cells,line})=>{
    if(cells.length!==header.length) throw new Error(`${name}:${line}: incorrect number of columns.`);
    const row = Object.fromEntries(header.map((key,i)=>[key,cells[i].trim()]));
    for(const key of header) {
      if(key.endsWith('_cents')) row[key]=cents(row[key]);
      else if(key.endsWith('_id') && !/^[A-Za-z0-9_-]{1,64}$/.test(row[key])) throw new Error(`${name}:${line}: invalid identifier.`);
      else if(key.endsWith('_date') && !isoDate(row[key])) throw new Error(`${name}:${line}: invalid date.`);
      else if(key==='currency' && !/^[A-Z]{3}$/.test(row[key])) throw new Error(`${name}:${line}: invalid currency.`);
    }
    return {...row, evidence:{source:kind,file:name,line,raw:cells,columns:header}};
  });
}
function duplicates(rows,key) { const seen=new Set(), dup=new Set(); for(const row of rows){if(seen.has(row[key])) dup.add(row[key]);seen.add(row[key]);}return dup; }
function validateSource(rows,kind) {
  if(!Array.isArray(rows)) throw new Error(`Missing ${kind} source.`);
  if(rows.length>5000) throw new Error('A source exceeds 5,000 records.');
  for(const row of rows) {
    const e=row.evidence;
    if(!e || e.source!==kind || typeof e.file!=='string' || !Number.isSafeInteger(e.line) || e.line<2 || !Array.isArray(e.raw) || !Array.isArray(e.columns) || e.raw.length!==e.columns.length || e.columns.length!==schemas[kind].length || new Set(e.columns).size!==schemas[kind].length || schemas[kind].some(k=>!e.columns.includes(k))) throw new Error('Each record must retain its original source evidence.');
    for(const key of schemas[kind]) {
      const raw=e.raw[e.columns.indexOf(key)];
      if(typeof raw!=='string') throw new Error('Invalid source evidence.');
      const original=raw.trim(), value=row[key];
      if(key.endsWith('_cents')) {
        if(typeof value!=='number' || !Number.isSafeInteger(value) || cents(original)!==value) throw new Error('Integer cents must agree with the cited source row.');
      } else if(value!==original || (key.endsWith('_id') && !/^[A-Za-z0-9_-]{1,64}$/.test(value)) || (key.endsWith('_date') && !isoDate(value)) || (key==='currency' && !/^[A-Z]{3}$/.test(value))) throw new Error('Record fields must agree with valid source evidence.');
    }
  }
}
export function reconcile(sources, {cutoff,currency='BRL'}={}) {
  if(!isoDate(cutoff)) throw new Error('Choose a valid closing date.');
  if(!/^[A-Z]{3}$/.test(currency)) throw new Error('Choose one currency.');
  for(const kind of Object.keys(schemas)) validateSource(sources[kind],kind);
  const {orders,settlements,refunds}=sources;
  if([...orders,...settlements,...refunds].some(row=>row.currency!==currency)) throw new Error('Mixed currencies need separate closes. No exchange rate is inferred.');
  const dup=Object.fromEntries(Object.keys(schemas).map(k=>[k,duplicates(sources[k],idFields[k])]));
  const orderIds=new Set(orders.map(o=>o.order_id)), output=[], done=new Set();
  for(const order of orders) {
    if(done.has(order.order_id)) continue; done.add(order.order_id);
    const allOrders=orders.filter(r=>r.order_id===order.order_id);
    const allPayments=settlements.filter(r=>r.order_id===order.order_id);
    const allRefunds=refunds.filter(r=>r.order_id===order.order_id);
    const payments=allPayments.filter(r=>r.posted_date<=cutoff), returns=allRefunds.filter(r=>r.posted_date<=cutoff);
    const evidence=[...allOrders,...payments,...returns].map(r=>r.evidence);
    const excludedFutureRows=[...allPayments,...allRefunds].filter(r=>r.posted_date>cutoff).map(r=>r.evidence);
    const base={key:`orders:${order.order_id}`,id:order.order_id,evidence,excludedFutureRows};
    const blocked=dup.orders.has(order.order_id)||allPayments.some(r=>dup.settlements.has(r.txn_id))||allRefunds.some(r=>dup.refunds.has(r.refund_id));
    if(blocked){output.push({...base,status:'review',reason:'Duplicate identifiers must be resolved before counting this order.',evidence:[...allOrders,...allPayments,...allRefunds].map(r=>r.evidence)});continue;}
    const refundCents=returns.reduce((s,r)=>s+r.refund_cents,0), expected=order.gross_cents-order.fee_cents-refundCents;
    const observed=payments.reduce((s,r)=>s+r.net_cents,0), difference=expected-observed;
    if(expected<0){output.push({...base,status:'review',reason:'Refunds and fees exceed the order gross. Check the source records.'});continue;}
    const status=difference===0?'matched':difference<0?'surplus':order.due_date>cutoff?'pending':observed===0?'unsettled':'shortfall';
    const reason={matched:refundCents?'The refund and stated fee explain the net settlement.':payments.length>1?'Split settlements add up to the expected net.':'The stated fee explains the gross-to-net difference.',pending:observed>0?'A partial amount was received; the remaining balance is not due at this close. Recheck on the contractual due date.':'The contractual settlement date is after this close. The remaining balance is not due yet.',unsettled:'The due date has passed; no settlement was posted on or before this closing date in these sources.',shortfall:'The received amount is lower than expected after the stated fee and refunds. The cause remains unproven.',surplus:'The received amount exceeds the expected net. Check the contract and source records.'}[status];
    output.push({...base,status,reason,gross:order.gross_cents,fee:order.fee_cents,refunds:refundCents,expected,observed,difference,dueDate:order.due_date});
  }
  for(const kind of ['settlements','refunds']) {
    const orphans=sources[kind].filter(r=>!orderIds.has(r.order_id) && r.posted_date<=cutoff), emitted=new Set();
    for(const row of orphans) {
      const id=row[idFields[kind]]; if(emitted.has(id))continue; emitted.add(id);
      const repeated=dup[kind].has(id);
      output.push({key:`${kind}:${id}`,id,status:'review',reason:repeated?'Duplicate identifiers affect a transaction with no matching order. Resolve both source problems before counting it.':`${kind==='refunds'?'Refund':'Settlement'} has no matching order. Supply the missing order before counting it.`,evidence:(repeated?sources[kind].filter(r=>r[idFields[kind]]===id):[row]).map(r=>r.evidence)});
    }
  }
  const counted=output.filter(r=>r.expected!==undefined);
  const due=counted.filter(r=>r.dueDate<=cutoff), notDue=counted.filter(r=>r.dueDate>cutoff);
  return {cutoff,currency,cases:output,excludedFutureRows:[...settlements,...refunds].filter(r=>r.posted_date>cutoff).map(r=>r.evidence),summary:{orders:orderIds.size,matched:output.filter(r=>r.status==='matched').length,review:output.filter(r=>r.status==='review').length,pending:output.filter(r=>r.status==='pending').length,unexplained:due.filter(r=>['shortfall','unsettled','surplus'].includes(r.status)).reduce((s,r)=>s+Math.abs(r.difference),0),expected:counted.reduce((s,r)=>s+r.expected,0),observed:counted.reduce((s,r)=>s+r.observed,0),expectedDue:due.reduce((s,r)=>s+r.expected,0),observedDue:due.reduce((s,r)=>s+r.observed,0),expectedNotDue:notDue.reduce((s,r)=>s+r.expected,0),observedNotDue:notDue.reduce((s,r)=>s+r.observed,0)},policy:'As-of close. Expected net = order gross - explicitly supplied fee - posted refunds. Fees are not refunded. Future postings are excluded from arithmetic and listed separately. Duplicate identifiers anywhere in a source quarantine the affected order. Unexplained totals include only due orders; expected/observed include all non-review orders, with due and not-due subtotals. No currencies are converted. Source records are not independently verified.'};
}
