// src/fixtures.mjs
var demo = {
  name: "Ateli\xEA Aurora \u2014 fictional October close",
  cutoff: "2026-10-21",
  currency: "BRL",
  orders: `order_id,gross_cents,fee_cents,currency,due_date
A-1001,10000,300,BRL,2026-10-20
A-1002,20000,600,BRL,2026-10-20
A-1003,15000,450,BRL,2026-10-20
A-1004,8000,240,BRL,2026-10-20
A-1005,12000,360,BRL,2026-10-20
A-1006,9000,270,BRL,2026-10-20
A-1007,6000,180,BRL,2026-10-22`,
  settlements: `txn_id,order_id,net_cents,currency,posted_date
S-001,A-1001,9700,BRL,2026-10-20
S-002,A-1002,18400,BRL,2026-10-20
S-003,A-1003,7000,BRL,2026-10-20
S-004,A-1003,7550,BRL,2026-10-21
S-005,A-1004,5760,BRL,2026-10-21
S-006,A-1006,8730,BRL,2026-10-20
S-006,A-1006,8730,BRL,2026-10-20
S-007,A-1007,5820,BRL,2026-10-22
S-008,A-9999,1000,BRL,2026-10-20`,
  refunds: `refund_id,order_id,refund_cents,currency,posted_date
R-001,A-1004,2000,BRL,2026-10-21`
};

// src/core.mjs
var schemas = {
  orders: ["order_id", "gross_cents", "fee_cents", "currency", "due_date"],
  settlements: ["txn_id", "order_id", "net_cents", "currency", "posted_date"],
  refunds: ["refund_id", "order_id", "refund_cents", "currency", "posted_date"]
};
var idFields = { orders: "order_id", settlements: "txn_id", refunds: "refund_id" };
var isoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
function cents(value) {
  if (!/^\d{1,12}$/.test(String(value))) throw new Error("Amounts must be non-negative integer cents.");
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount > 1e11) throw new Error("Amount exceeds the supported limit.");
  return amount;
}
function parseCSV(text, kind, name = `${kind}.csv`) {
  if (!schemas[kind]) throw new Error("Unsupported source type.");
  if (new TextEncoder().encode(text).length > 2e6) throw new Error("A source exceeds 2 MB.");
  text = text.replace(/^\uFEFF/, "");
  const records = [];
  let cells = [], field = "", quoted = false, afterQuote = false, line = 1, start = 1;
  const endCell = () => {
    cells.push(field);
    field = "";
    afterQuote = false;
  };
  const endRow = () => {
    endCell();
    if (cells.some((s) => s !== "")) records.push({ cells, line: start });
    cells = [];
    start = line + 1;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        field += ch;
        if (ch === "\n") line++;
      }
      continue;
    }
    if (afterQuote && ![",", "\n", "\r"].includes(ch)) throw new Error(`Unexpected characters after quote at line ${line}.`);
    if (ch === '"') {
      if (field !== "") throw new Error(`Unexpected quote at line ${line}.`);
      quoted = true;
    } else if (ch === ",") endCell();
    else if (ch === "\n") {
      endRow();
      line++;
    } else if (ch === "\r") {
      if (text[i + 1] !== "\n") {
        endRow();
        line++;
      }
    } else field += ch;
  }
  if (quoted) throw new Error("Unclosed CSV quote.");
  if (field !== "" || cells.length || afterQuote) endRow();
  const header = records.shift()?.cells.map((s) => s.trim());
  if (!header || new Set(header).size !== header.length || schemas[kind].some((key) => !header.includes(key)) || header.some((key) => !schemas[kind].includes(key))) throw new Error(`${name}: use the required ${kind} column headers.`);
  if (records.length > 5e3) throw new Error("A source exceeds 5,000 records.");
  return records.map(({ cells: cells2, line: line2 }) => {
    if (cells2.length !== header.length) throw new Error(`${name}:${line2}: incorrect number of columns.`);
    const row = Object.fromEntries(header.map((key, i) => [key, cells2[i].trim()]));
    for (const key of header) {
      if (key.endsWith("_cents")) row[key] = cents(row[key]);
      else if (key.endsWith("_id") && !/^[A-Za-z0-9_-]{1,64}$/.test(row[key])) throw new Error(`${name}:${line2}: invalid identifier.`);
      else if (key.endsWith("_date") && !isoDate(row[key])) throw new Error(`${name}:${line2}: invalid date.`);
      else if (key === "currency" && !/^[A-Z]{3}$/.test(row[key])) throw new Error(`${name}:${line2}: invalid currency.`);
    }
    return { ...row, evidence: { source: kind, file: name, line: line2, raw: cells2, columns: header } };
  });
}
function duplicates(rows, key) {
  const seen = /* @__PURE__ */ new Set(), dup = /* @__PURE__ */ new Set();
  for (const row of rows) {
    if (seen.has(row[key])) dup.add(row[key]);
    seen.add(row[key]);
  }
  return dup;
}
function validateSource(rows, kind) {
  if (!Array.isArray(rows)) throw new Error(`Missing ${kind} source.`);
  if (rows.length > 5e3) throw new Error("A source exceeds 5,000 records.");
  for (const row of rows) {
    const e = row.evidence;
    if (!e || e.source !== kind || typeof e.file !== "string" || !Number.isSafeInteger(e.line) || e.line < 2 || !Array.isArray(e.raw) || !Array.isArray(e.columns) || e.raw.length !== e.columns.length || e.columns.length !== schemas[kind].length || new Set(e.columns).size !== schemas[kind].length || schemas[kind].some((k) => !e.columns.includes(k))) throw new Error("Each record must retain its original source evidence.");
    for (const key of schemas[kind]) {
      const raw = e.raw[e.columns.indexOf(key)];
      if (typeof raw !== "string") throw new Error("Invalid source evidence.");
      const original = raw.trim(), value = row[key];
      if (key.endsWith("_cents")) {
        if (typeof value !== "number" || !Number.isSafeInteger(value) || cents(original) !== value) throw new Error("Integer cents must agree with the cited source row.");
      } else if (value !== original || key.endsWith("_id") && !/^[A-Za-z0-9_-]{1,64}$/.test(value) || key.endsWith("_date") && !isoDate(value) || key === "currency" && !/^[A-Z]{3}$/.test(value)) throw new Error("Record fields must agree with valid source evidence.");
    }
  }
}
function reconcile(sources, { cutoff, currency = "BRL" } = {}) {
  if (!isoDate(cutoff)) throw new Error("Choose a valid closing date.");
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Choose one currency.");
  for (const kind of Object.keys(schemas)) validateSource(sources[kind], kind);
  const { orders, settlements, refunds } = sources;
  if ([...orders, ...settlements, ...refunds].some((row) => row.currency !== currency)) throw new Error("Mixed currencies need separate closes. No exchange rate is inferred.");
  const dup = Object.fromEntries(Object.keys(schemas).map((k) => [k, duplicates(sources[k], idFields[k])]));
  const orderIds = new Set(orders.map((o) => o.order_id)), output = [], done = /* @__PURE__ */ new Set();
  for (const order of orders) {
    if (done.has(order.order_id)) continue;
    done.add(order.order_id);
    const allOrders = orders.filter((r) => r.order_id === order.order_id);
    const allPayments = settlements.filter((r) => r.order_id === order.order_id);
    const allRefunds = refunds.filter((r) => r.order_id === order.order_id);
    const payments = allPayments.filter((r) => r.posted_date <= cutoff), returns = allRefunds.filter((r) => r.posted_date <= cutoff);
    const evidence = [...allOrders, ...payments, ...returns].map((r) => r.evidence);
    const excludedFutureRows = [...allPayments, ...allRefunds].filter((r) => r.posted_date > cutoff).map((r) => r.evidence);
    const base = { key: `orders:${order.order_id}`, id: order.order_id, evidence, excludedFutureRows };
    const blocked = dup.orders.has(order.order_id) || allPayments.some((r) => dup.settlements.has(r.txn_id)) || allRefunds.some((r) => dup.refunds.has(r.refund_id));
    if (blocked) {
      output.push({ ...base, status: "review", reason: "Duplicate identifiers must be resolved before counting this order.", evidence: [...allOrders, ...allPayments, ...allRefunds].map((r) => r.evidence) });
      continue;
    }
    const refundCents = returns.reduce((s, r) => s + r.refund_cents, 0), expected = order.gross_cents - order.fee_cents - refundCents;
    const observed = payments.reduce((s, r) => s + r.net_cents, 0), difference = expected - observed;
    if (expected < 0) {
      output.push({ ...base, status: "review", reason: "Refunds and fees exceed the order gross. Check the source records." });
      continue;
    }
    const status = difference === 0 ? "matched" : difference < 0 ? "surplus" : order.due_date > cutoff ? "pending" : observed === 0 ? "unsettled" : "shortfall";
    const reason = { matched: refundCents ? "The refund and stated fee explain the net settlement." : payments.length > 1 ? "Split settlements add up to the expected net." : "The stated fee explains the gross-to-net difference.", pending: observed > 0 ? "A partial amount was received; the remaining balance is not due at this close. Recheck on the contractual due date." : "The contractual settlement date is after this close. The remaining balance is not due yet.", unsettled: "The due date has passed; no settlement was posted on or before this closing date in these sources.", shortfall: "The received amount is lower than expected after the stated fee and refunds. The cause remains unproven.", surplus: "The received amount exceeds the expected net. Check the contract and source records." }[status];
    output.push({ ...base, status, reason, gross: order.gross_cents, fee: order.fee_cents, refunds: refundCents, expected, observed, difference, dueDate: order.due_date });
  }
  for (const kind of ["settlements", "refunds"]) {
    const orphans = sources[kind].filter((r) => !orderIds.has(r.order_id) && r.posted_date <= cutoff), emitted = /* @__PURE__ */ new Set();
    for (const row of orphans) {
      const id = row[idFields[kind]];
      if (emitted.has(id)) continue;
      emitted.add(id);
      const repeated = dup[kind].has(id);
      output.push({ key: `${kind}:${id}`, id, status: "review", reason: repeated ? "Duplicate identifiers affect a transaction with no matching order. Resolve both source problems before counting it." : `${kind === "refunds" ? "Refund" : "Settlement"} has no matching order. Supply the missing order before counting it.`, evidence: (repeated ? sources[kind].filter((r) => r[idFields[kind]] === id) : [row]).map((r) => r.evidence) });
    }
  }
  const counted = output.filter((r) => r.expected !== void 0);
  const due = counted.filter((r) => r.dueDate <= cutoff), notDue = counted.filter((r) => r.dueDate > cutoff);
  return { cutoff, currency, cases: output, excludedFutureRows: [...settlements, ...refunds].filter((r) => r.posted_date > cutoff).map((r) => r.evidence), summary: { orders: orderIds.size, matched: output.filter((r) => r.status === "matched").length, review: output.filter((r) => r.status === "review").length, pending: output.filter((r) => r.status === "pending").length, unexplained: due.filter((r) => ["shortfall", "unsettled", "surplus"].includes(r.status)).reduce((s, r) => s + Math.abs(r.difference), 0), expected: counted.reduce((s, r) => s + r.expected, 0), observed: counted.reduce((s, r) => s + r.observed, 0), expectedDue: due.reduce((s, r) => s + r.expected, 0), observedDue: due.reduce((s, r) => s + r.observed, 0), expectedNotDue: notDue.reduce((s, r) => s + r.expected, 0), observedNotDue: notDue.reduce((s, r) => s + r.observed, 0) }, policy: "As-of close. Expected net = order gross - explicitly supplied fee - posted refunds. Fees are not refunded. Future postings are excluded from arithmetic and listed separately. Duplicate identifiers anywhere in a source quarantine the affected order. Unexplained totals include only due orders; expected/observed include all non-review orders, with due and not-due subtotals. No currencies are converted. Source records are not independently verified." };
}

// no-fs:node:fs
var node_fs_default = new Proxy({}, { get: () => () => {
  throw new Error("Filesystem persistence is unavailable in this browser workspace");
} });

// no-fs:node:path
var node_path_default = { join: (...parts) => parts.join("/") };

// third-party/meterless-hmem/src/types.ts
var FEEDBACK_DELTAS = { helpful: 0.05, not_helpful: -0.03, wrong: -0.2 };
var DEFAULTS = {
  retrievalTopN: 5,
  retrievalThreshold: 0.35,
  // on the final score, after the confidence multiplier
  consolidationDays: 7,
  archiveMinDays: 30,
  archiveMaxAccess: 2,
  synthesisCosine: 0.82,
  dreamClusterMinSize: 2,
  dreamRelatedness: 0.35,
  maxDreamProposalsPerType: 8,
  conflictAutoResolveGate: 0.7,
  entityCap: 10,
  relatedCap: 5,
  recencyDays: 14
};
var clamp01 = (x) => Math.min(1, Math.max(0, x));
var DAY_MS = 24 * 60 * 60 * 1e3;

// third-party/meterless-hmem/src/embeddings.ts
var DIM = 64;
function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t2) => t2.length > 1);
}
function fnv1a(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function embed(text) {
  const vec = new Array(DIM).fill(0);
  for (const token of tokenize(text)) {
    const h = fnv1a(token);
    const idx = h % DIM;
    const sign = (h >>> 8) % 2 === 0 ? 1 : -1;
    const mag = 1 + (h >>> 16) % 8 / 8;
    vec[idx] += sign * mag;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return norm === 0 ? vec : vec.map((v) => v / norm);
}
function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
function jaccard(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  return inter / (sa.size + sb.size - inter);
}

// third-party/meterless-hmem/src/memoryStore.ts
var TECH_TERMS = [
  "react",
  "python",
  "typescript",
  "javascript",
  "rust",
  "sqlite",
  "postgres",
  "indexeddb",
  "node",
  "docker",
  "graphql",
  "redis",
  "webrtc",
  "tauri",
  "electron",
  "llm",
  "embedding"
];
var DOMAIN_KEYWORDS = {
  tech: ["code", "bug", "api", "database", "deploy", "framework", "library", "server", ...TECH_TERMS],
  work: ["meeting", "deadline", "client", "project", "sprint", "review", "report"],
  personal: ["family", "hobby", "prefer", "like", "dislike", "morning", "evening"]
};
var MemoryStoreService = class {
  constructor(clock, ledger, actor, persistDir) {
    this.clock = clock;
    this.ledger = ledger;
    this.actor = actor;
    if (persistDir) {
      node_fs_default.mkdirSync(persistDir, { recursive: true });
      this.stateFile = node_path_default.join(persistDir, "state.json");
      if (node_fs_default.existsSync(this.stateFile)) {
        const saved = JSON.parse(node_fs_default.readFileSync(this.stateFile, "utf-8"));
        this.seq = saved.seq;
        for (const r of saved.records) this.records.set(r.id, r);
      }
    }
  }
  clock;
  ledger;
  actor;
  records = /* @__PURE__ */ new Map();
  seq = 0;
  stateFile;
  persist() {
    if (!this.stateFile) return;
    const records = [...this.records.values()].sort((a, b) => a.id.localeCompare(b.id));
    node_fs_default.writeFileSync(this.stateFile, JSON.stringify({ seq: this.seq, records }, null, 2) + "\n", "utf-8");
  }
  add(input) {
    if (!input.source || input.source.trim() === "") {
      throw new Error("H-MEM: a memory record with no source must be rejected by construction (AGENTS.md section 2)");
    }
    const now = this.clock();
    const id = `mem-${++this.seq}`;
    const tags = [...input.tags ?? []];
    const domain = this.classifyDomain(input.content, tags, input.type ?? "general");
    const record = {
      id,
      content: input.content,
      type: input.type ?? "general",
      layer: input.layer ?? "working",
      timestamp: now,
      lastAccessed: now,
      accessCount: 0,
      tags,
      embedding: embed(input.content),
      confidence: clamp01(input.confidence ?? 0.7),
      source: input.source,
      provenance: input.provenance ?? { origin: "manual", learnedAt: now, label: input.source },
      chatId: input.chatId,
      missionId: input.missionId,
      goalRunId: input.goalRunId,
      domain,
      namespace: this.namespace(domain, input.type ?? "general"),
      entities: this.extractEntities(input.content),
      relatedTo: [],
      supersedes: input.supersedes,
      derivedFrom: input.derivedFrom
    };
    this.discoverRelationships(record);
    this.records.set(id, record);
    this.ledger.log(id, "create", this.actor, { newState: snapshot(record) });
    this.persist();
    return record;
  }
  get(id) {
    return this.records.get(id);
  }
  all() {
    return [...this.records.values()];
  }
  update(id, patch) {
    const rec = this.mustGet(id);
    const prev = snapshot(rec);
    Object.assign(rec, patch);
    this.ledger.log(id, "update", this.actor, { previousState: prev, newState: snapshot(rec) });
    this.persist();
    return rec;
  }
  delete(id, reason) {
    const rec = this.mustGet(id);
    this.records.delete(id);
    this.ledger.log(id, "delete", this.actor, { previousState: snapshot(rec), details: { reason } });
    this.persist();
  }
  touch(id) {
    const rec = this.mustGet(id);
    rec.lastAccessed = this.clock();
    rec.accessCount += 1;
  }
  promote(id, layer) {
    const rec = this.mustGet(id);
    const prev = snapshot(rec);
    rec.layer = layer;
    this.ledger.log(id, "promote", this.actor, { previousState: prev, newState: snapshot(rec) });
    this.persist();
  }
  restoreAll(records, seq) {
    this.records = new Map(records.map((r) => [r.id, structuredClone(r)]));
    this.seq = seq;
    this.persist();
  }
  snapshotAll() {
    return { records: structuredClone([...this.records.values()]), seq: this.seq };
  }
  mustGet(id) {
    const rec = this.records.get(id);
    if (!rec) throw new Error(`H-MEM: unknown memory id ${id}`);
    return rec;
  }
  // Multi-pass domain classification (AGENTS.md section 5).
  classifyDomain(content, tags, type) {
    for (const t2 of tags) {
      if (t2.startsWith("project:")) return t2.slice("project:".length);
      if (t2.startsWith("tech:")) return "tech";
    }
    const tokens = new Set(tokenize(content));
    let best = "general";
    let bestScore = 0;
    for (const [domain, kws] of Object.entries(DOMAIN_KEYWORDS)) {
      let score = kws.reduce((s, kw) => s + (tokens.has(kw) ? 1 : 0), 0);
      if (domain === "personal" && (type === "personal" || type === "preference")) score += 1;
      if (score > bestScore) {
        best = domain;
        bestScore = score;
      }
    }
    return bestScore > 0 ? best : "general";
  }
  namespace(domain, type) {
    const bucket = type === "preference" || type === "personal" ? "profile" : type === "factual" ? "facts" : "notes";
    return `${domain}/${bucket}`;
  }
  extractEntities(content) {
    const entities = /* @__PURE__ */ new Set();
    for (const t2 of tokenize(content)) if (TECH_TERMS.includes(t2)) entities.add(t2);
    for (const m of content.matchAll(/\b([A-Z][a-zA-Z]{2,})\b/g)) {
      const norm = m[1].toLowerCase();
      if (!["the", "this", "that", "with"].includes(norm)) entities.add(norm);
    }
    return [...entities].slice(0, DEFAULTS.entityCap);
  }
  discoverRelationships(record) {
    const CORRECTION = /\b(actually|instead|no longer|not anymore|changed to|correction)\b/i;
    for (const other of this.records.values()) {
      if (record.relatedTo.length >= DEFAULTS.relatedCap) break;
      const sharedEntities = other.entities.filter((e) => record.entities.includes(e));
      const sim = cosine(record.embedding, other.embedding);
      if (!record.supersedes && sim > 0.85 && CORRECTION.test(record.content)) {
        record.supersedes = other.id;
        continue;
      }
      if (sharedEntities.length >= 1 && other.domain === record.domain) {
        record.relatedTo.push(other.id);
        if (other.relatedTo.length < DEFAULTS.relatedCap && !other.relatedTo.includes(record.id)) {
          other.relatedTo.push(record.id);
        }
      }
    }
  }
};
function snapshot(r) {
  const { embedding, ...rest } = structuredClone(r);
  return rest;
}

// third-party/meterless-hmem/src/trustLedger.ts
var TrustLedgerService = class {
  constructor(clock, persistDir) {
    this.clock = clock;
    if (persistDir) {
      this.file = node_path_default.join(persistDir, "ledger.jsonl");
      if (node_fs_default.existsSync(this.file)) {
        this.entries = node_fs_default.readFileSync(this.file, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
      }
    }
  }
  clock;
  entries = [];
  file;
  log(memoryId, action, actor, extra) {
    const entry = { memoryId, action, actor, timestamp: this.clock(), ...extra };
    this.entries.push(entry);
    if (this.file) node_fs_default.appendFileSync(this.file, JSON.stringify(entry) + "\n", "utf-8");
    return entry;
  }
  history(memoryId) {
    return this.entries.filter((e) => e.memoryId === memoryId);
  }
  all() {
    return this.entries;
  }
  stats() {
    const out = {};
    for (const e of this.entries) out[e.action] = (out[e.action] ?? 0) + 1;
    return out;
  }
};

// third-party/meterless-hmem/src/memoryMining.ts
var EVENT_TYPE_MAP = {
  chat_message: "general",
  user_correction: "preference",
  file_save: "factual",
  file_open: "general",
  file_edit: "factual",
  model_response: "factual",
  plan_completion: "factual"
};
var SIGNAL = /\b(prefer|always|never|decided|chose|choose|use|because|instead|must|should|important|remember)\b/i;
var MemoryMiningService = class {
  constructor(store, clock, minerFn) {
    this.store = store;
    this.clock = clock;
    this.minerFn = minerFn;
  }
  store;
  clock;
  minerFn;
  async mineInteraction(event, text, opts) {
    const candidates = this.minerFn ? await this.mineWithModel(event, text) : this.mineModelFree(text);
    return candidates.map(
      (content) => this.store.add({
        content,
        type: EVENT_TYPE_MAP[event],
        layer: opts?.layer ?? (this.minerFn ? "working" : "short_term"),
        tags: [`event:${event}`],
        source: `interaction:${event}`,
        provenance: { origin: event, learnedAt: this.clock(), label: `mined from ${event}` },
        chatId: opts?.chatId
      })
    );
  }
  async mineDocument(fileName, text) {
    const truncated = text.slice(0, 8e3);
    const candidates = this.minerFn ? await this.mineWithModel("file_save", truncated) : this.mineModelFree(truncated);
    return candidates.map(
      (content) => this.store.add({
        content,
        type: "factual",
        layer: "working",
        tags: ["document", `file:${fileName}`],
        source: `document:${fileName}`
      })
    );
  }
  // 4.3: no-model fallback. Concise direct summaries as short-term memories.
  mineModelFree(text) {
    return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length >= 20 && s.length <= 300 && SIGNAL.test(s)).slice(0, 10);
  }
  async mineWithModel(event, text) {
    const prompt = `Extract durable memories from this ${event} as a strict JSON array of strings:

${text}`;
    const rawResponse = await this.minerFn(prompt);
    return parseStrictJsonArray(rawResponse);
  }
};
function parseStrictJsonArray(raw) {
  let cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === "string" && x.trim().length >= 5);
  } catch {
    return [];
  }
}

// third-party/meterless-hmem/src/memoryRetrieval.ts
var LAYER_WEIGHT = {
  long_term: 1,
  working: 0.8,
  short_term: 0.6
};
var MemoryRetrievalService = class {
  constructor(store, ledger, clock, actor) {
    this.store = store;
    this.ledger = ledger;
    this.clock = clock;
    this.actor = actor;
  }
  store;
  ledger;
  clock;
  actor;
  scoreOne(memory, query) {
    const queryEmbedding = embed(query);
    const queryTokens = tokenize(query).slice(0, 8);
    const queryEntities = this.store.extractEntities(query);
    const queryDomain = this.store.classifyDomain(query, [], "general");
    return this.score(memory, queryEmbedding, queryTokens, queryEntities, queryDomain);
  }
  score(m, queryEmbedding, queryTokens, queryEntities, queryDomain) {
    const semantic = clamp01(cosine(queryEmbedding, m.embedding));
    const keyword = jaccard(queryTokens, tokenize(m.content));
    const tag = jaccard(queryTokens, m.tags.map((t2) => t2.toLowerCase()));
    const domain = m.domain === queryDomain ? 1 : 0;
    const entity = jaccard(queryEntities, m.entities);
    const layer = LAYER_WEIGHT[m.layer];
    const ageDays = (this.clock() - m.lastAccessed) / DAY_MS;
    const recency = Math.exp(-ageDays / DEFAULTS.recencyDays);
    const superseded = m.supersededBy ? 1 : 0;
    const raw = 0.35 * semantic + 0.2 * keyword + 0.1 * tag + 0.1 * domain + 0.15 * entity + 0.05 * layer + 0.05 * recency - 0.2 * superseded;
    return clamp01(raw) * m.confidence;
  }
  query(query, opts) {
    const queryEmbedding = embed(query);
    const queryTokens = tokenize(query).slice(0, 8);
    const queryEntities = this.store.extractEntities(query);
    const queryDomain = this.store.classifyDomain(query, [], "general");
    const threshold = opts?.threshold ?? DEFAULTS.retrievalThreshold;
    const topN = opts?.topN ?? DEFAULTS.retrievalTopN;
    const scored = [];
    for (const m of this.store.all()) {
      if (opts?.chatId && m.chatId && m.chatId !== opts.chatId) continue;
      const s = this.score(m, queryEmbedding, queryTokens, queryEntities, queryDomain);
      if (s >= threshold) scored.push({ memory: m, relevance: s });
    }
    scored.sort((a, b) => b.relevance - a.relevance || a.memory.id.localeCompare(b.memory.id));
    const top = scored.slice(0, topN);
    for (const { memory } of top) {
      this.store.touch(memory.id);
      this.ledger.log(memory.id, "read", this.actor, { details: { query } });
    }
    const strategy = top.length <= 1 ? "minimal" : top.some((t2) => t2.memory.type === "personal" || t2.memory.type === "preference") ? "personal" : "comprehensive";
    return {
      memories: top,
      context: this.formatReinjection(top),
      trace: {
        retrievalReason: `hybrid ranking for "${query}" (domain: ${queryDomain})`,
        strategy,
        scores: Object.fromEntries(top.map((t2) => [t2.memory.id, Number(t2.relevance.toFixed(4))]))
      }
    };
  }
  // Domain-grouped reinjection blocks with layer markers and entities (section 6.2).
  formatReinjection(items) {
    if (items.length === 0) return "";
    const byDomain = /* @__PURE__ */ new Map();
    for (const it of items) {
      const list = byDomain.get(it.memory.domain) ?? [];
      list.push(it);
      byDomain.set(it.memory.domain, list);
    }
    const lines = ["[MEMORY CONTEXT]"];
    for (const [domain, list] of [...byDomain.entries()].sort()) {
      lines.push(`## ${domain}`);
      for (const { memory } of list) {
        const marker = memory.layer === "long_term" ? "LT" : memory.layer === "working" ? "WK" : "ST";
        const ents = memory.entities.length ? ` (entities: ${memory.entities.join(", ")})` : "";
        lines.push(`- [${marker}] ${memory.content}${ents} <${memory.id}>`);
      }
    }
    lines.push("[/MEMORY CONTEXT]");
    return lines.join("\n");
  }
  // Exact feedback deltas (AGENTS.md section 9.2).
  feedback(memoryId, kind) {
    const m = this.store.get(memoryId);
    if (!m) throw new Error(`H-MEM: unknown memory id ${memoryId}`);
    const prev = snapshot(m);
    if (kind === "helpful") m.accessCount += 1;
    m.confidence = clamp01(m.confidence + FEEDBACK_DELTAS[kind]);
    if (kind === "wrong" && !m.tags.includes("review")) m.tags.push("review");
    this.ledger.log(memoryId, "feedback", this.actor, {
      previousState: prev,
      newState: snapshot(m),
      details: { kind, delta: FEEDBACK_DELTAS[kind] }
    });
    this.store.persist();
  }
};

// third-party/meterless-hmem/src/conflictDetection.ts
var OPPOSING_PAIRS = [
  [/\balways\b/i, /\bnever\b/i],
  [/\benable[ds]?\b/i, /\bdisable[ds]?\b/i],
  [/\bprefer[s]?\b/i, /\bavoid[s]?|dislike[s]?\b/i],
  [/\bon\b/i, /\boff\b/i],
  [/\byes\b/i, /\bno\b/i]
];
var ConflictDetectionService = class {
  constructor(store, ledger, clock, actor) {
    this.store = store;
    this.ledger = ledger;
    this.clock = clock;
    this.actor = actor;
  }
  store;
  ledger;
  clock;
  actor;
  conflicts = [];
  seq = 0;
  scan() {
    const found = [];
    const all = this.store.all();
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const conflict = this.check(all[i], all[j]);
        if (conflict) {
          found.push(conflict);
          this.conflicts.push(conflict);
          this.ledger.log(conflict.memoryA, "conflict_detected", this.actor, {
            details: { with: conflict.memoryB, reason: conflict.reason, confidence: conflict.confidence }
          });
        }
      }
    }
    return found;
  }
  check(a, b) {
    if (a.supersedes === b.id || b.supersedes === a.id || a.supersededBy === b.id || b.supersededBy === a.id) return void 0;
    const sim = cosine(a.embedding, b.embedding);
    let reason = "";
    let confidence = 0;
    for (const [p, q] of OPPOSING_PAIRS) {
      if (p.test(a.content) && q.test(b.content) || q.test(a.content) && p.test(b.content)) {
        if (sim > 0.5) {
          reason = "opposing phrase pair on similar content";
          confidence = 0.5 + 0.3 * sim;
        }
      }
    }
    if (!reason && sim > 0.8) {
      const numsA = a.content.match(/\d+(\.\d+)?/g) ?? [];
      const numsB = b.content.match(/\d+(\.\d+)?/g) ?? [];
      if (numsA.length && numsB.length && numsA.join() !== numsB.join()) {
        reason = "high-similarity conflicting numeric values";
        confidence = 0.55 + 0.25 * sim;
      }
    }
    if (!reason) return void 0;
    const sharedEntities = a.entities.filter((e) => b.entities.includes(e));
    if (sharedEntities.length > 0) confidence += 0.1;
    if (a.domain === b.domain) confidence += 0.05;
    if (a.relatedTo.includes(b.id)) confidence -= 0.1;
    return {
      id: `conflict-${++this.seq}`,
      memoryA: a.id,
      memoryB: b.id,
      reason,
      confidence: clamp01(confidence),
      resolved: false
    };
  }
  // Weighted auto-decision heuristics (section 10.2).
  autoResolve(conflict) {
    const a = this.store.get(conflict.memoryA);
    const b = this.store.get(conflict.memoryB);
    const scoreOf = (m) => 0.3 * (m.lastAccessed / Math.max(1, this.clock())) + 0.2 * Math.min(1, m.accessCount / 10) + 0.25 * m.confidence + 0.1 * Math.min(1, m.content.length / 200) + 0.15 * (m.provenance.origin === "user_correction" ? 1 : 0.5);
    const sa = scoreOf(a);
    const sb = scoreOf(b);
    const margin = Math.abs(sa - sb) / Math.max(sa, sb);
    const decisionConfidence = clamp01(conflict.confidence * 0.6 + margin * 0.8);
    if (decisionConfidence < DEFAULTS.conflictAutoResolveGate) return "queued";
    const winner = sa >= sb ? a : b;
    const loser = sa >= sb ? b : a;
    const prev = snapshot(loser);
    loser.supersededBy = winner.id;
    conflict.resolved = true;
    conflict.resolution = winner.id === conflict.memoryA ? "keep_a" : "keep_b";
    this.ledger.log(loser.id, "conflict_resolved", this.actor, {
      previousState: prev,
      newState: snapshot(loser),
      details: { conflictId: conflict.id, winner: winner.id, decisionConfidence: Number(decisionConfidence.toFixed(3)) }
    });
    this.store.persist();
    return "resolved";
  }
  queue() {
    return this.conflicts.filter((c) => !c.resolved);
  }
};

// third-party/meterless-hmem/src/sleepCycle.ts
var HUB_THRESHOLD = 3;
var SleepCycleService = class {
  constructor(store, ledger, clock, actor) {
    this.store = store;
    this.ledger = ledger;
    this.clock = clock;
    this.actor = actor;
  }
  store;
  ledger;
  clock;
  actor;
  backups = /* @__PURE__ */ new Map();
  backupSeq = 0;
  preview() {
    const now = this.clock();
    const all = this.store.all();
    const referenced = /* @__PURE__ */ new Set();
    for (const m of all) {
      for (const r of m.relatedTo) referenced.add(r);
      if (m.supersedes) referenced.add(m.supersedes);
      for (const d of m.derivedFrom ?? []) referenced.add(d);
    }
    const toConsolidate = all.filter((m) => m.layer === "short_term" && now - m.lastAccessed >= DEFAULTS.consolidationDays * DAY_MS).map((m) => m.id);
    const toArchive = all.filter((m) => {
      const oldEnough = now - m.timestamp >= DEFAULTS.archiveMinDays * DAY_MS;
      const lowAccess = m.accessCount <= DEFAULTS.archiveMaxAccess;
      const unreferenced = !referenced.has(m.id);
      if (!(oldEnough && lowAccess && unreferenced)) return false;
      if (m.supersedes) return false;
      if ((m.derivedFrom ?? []).length > 0) return false;
      if (m.relatedTo.length >= HUB_THRESHOLD) return false;
      return true;
    }).map((m) => m.id);
    const toSynthesize = [];
    const used = /* @__PURE__ */ new Set();
    for (let i = 0; i < all.length; i++) {
      if (used.has(all[i].id)) continue;
      const group = [all[i]];
      for (let j = i + 1; j < all.length; j++) {
        if (used.has(all[j].id)) continue;
        if (cosine(all[i].embedding, all[j].embedding) >= DEFAULTS.synthesisCosine) group.push(all[j]);
      }
      if (group.length >= 2) {
        for (const g of group) used.add(g.id);
        toSynthesize.push(group.map((g) => g.id));
      }
    }
    return { toConsolidate, toArchive, toSynthesize };
  }
  execute(preview) {
    const plan = preview ?? this.preview();
    const backupId = `backup-${++this.backupSeq}`;
    this.backups.set(backupId, this.store.snapshotAll());
    const actionLog = [`backup ${backupId} created`];
    for (const id of plan.toConsolidate) {
      const m = this.store.get(id);
      if (!m) continue;
      this.store.promote(id, "long_term");
      this.ledger.log(id, "sleep_consolidate", this.actor, { details: { from: "short_term", to: "long_term" } });
      actionLog.push(`consolidated ${id}`);
    }
    for (const id of plan.toArchive) {
      const m = this.store.get(id);
      if (!m) continue;
      this.ledger.log(id, "sleep_archive", this.actor, { details: { age: this.clock() - m.timestamp, accessCount: m.accessCount } });
      this.store.delete(id, "sleep archive");
      actionLog.push(`archived ${id}`);
    }
    let synthesized = 0;
    for (const group of plan.toSynthesize) {
      const members = group.map((id) => this.store.get(id)).filter((m) => !!m);
      if (members.length < 2) continue;
      const merged = this.store.add({
        content: `Synthesis: ${members.map((m) => m.content).join(" | ")}`,
        type: "factual",
        layer: "long_term",
        tags: [...new Set(members.flatMap((m) => m.tags))],
        confidence: Math.max(...members.map((m) => m.confidence)),
        source: "sleep:synthesis",
        provenance: { origin: "sleep_synthesis", learnedAt: this.clock(), label: `synthesized from ${members.length} memories` },
        derivedFrom: members.map((m) => m.id)
      });
      this.ledger.log(merged.id, "sleep_synthesize", this.actor, { details: { sources: group } });
      for (const m of members) this.store.delete(m.id, "merged by sleep synthesis");
      synthesized++;
      actionLog.push(`synthesized ${merged.id} from ${group.join(", ")}`);
    }
    this.store.persist();
    return {
      backupId,
      consolidated: plan.toConsolidate.length,
      archived: plan.toArchive.length,
      synthesized,
      actionLog
    };
  }
  restore(backupId) {
    const backup = this.backups.get(backupId);
    if (!backup) throw new Error(`H-MEM: unknown backup ${backupId}`);
    this.store.restoreAll(backup.records, backup.seq);
    this.ledger.log("*", "restore", this.actor, { details: { backupId } });
  }
};

// third-party/meterless-hmem/src/dreaming.ts
var DreamingService = class {
  constructor(store, ledger, clock, actor) {
    this.store = store;
    this.ledger = ledger;
    this.clock = clock;
    this.actor = actor;
  }
  store;
  ledger;
  clock;
  actor;
  proposals = /* @__PURE__ */ new Map();
  seq = 0;
  // Multi-signal relatedness: content similarity, tag overlap, shared domain/type, entity overlap.
  relatedness(a, b) {
    return 0.5 * Math.max(0, cosine(a.embedding, b.embedding)) + 0.2 * jaccard(a.tags, b.tags) + 0.1 * (a.domain === b.domain ? 1 : 0) + 0.2 * jaccard(a.entities, b.entities);
  }
  cluster() {
    const all = this.store.all();
    const used = /* @__PURE__ */ new Set();
    const clusters = [];
    for (const seed of all) {
      if (used.has(seed.id)) continue;
      const group = [seed];
      for (const other of all) {
        if (other.id === seed.id || used.has(other.id)) continue;
        if (this.relatedness(seed, other) >= DEFAULTS.dreamRelatedness) group.push(other);
      }
      if (group.length >= DEFAULTS.dreamClusterMinSize) {
        for (const g of group) used.add(g.id);
        clusters.push(group);
      }
    }
    return clusters;
  }
  dream() {
    const created = [];
    const propose = (p) => {
      const proposal = { ...p, id: `dream-${++this.seq}`, status: "proposed" };
      this.proposals.set(proposal.id, proposal);
      created.push(proposal);
      this.ledger.log(proposal.id, "dream_proposed", this.actor, { details: { type: p.type, derivedFrom: p.derivedFrom } });
    };
    let insights = 0;
    for (const cluster of this.cluster()) {
      if (insights >= DEFAULTS.maxDreamProposalsPerType) break;
      const domains2 = [...new Set(cluster.map((m) => m.domain))].join("/");
      propose({
        type: "insight",
        content: `Across ${cluster.length} related memories (${domains2}): ${cluster.map((m) => m.content).join(" + ")}`,
        derivedFrom: cluster.map((m) => m.id)
      });
      insights++;
    }
    let domains = 0;
    for (const m of this.store.all()) {
      if (domains >= DEFAULTS.maxDreamProposalsPerType) break;
      if (m.domain !== "general") continue;
      const suggested = this.store.classifyDomain(m.content, m.tags, m.type);
      if (suggested !== "general") {
        propose({ type: "domain", content: `Reclassify "${m.content.slice(0, 60)}" as ${suggested}`, derivedFrom: [m.id], suggestedDomain: suggested });
        domains++;
      }
    }
    let invariants = 0;
    const prefs = this.store.all().filter((m) => m.type === "preference" || m.type === "personal" || m.tags.includes("event:user_correction"));
    const byDomain = /* @__PURE__ */ new Map();
    for (const p of prefs) {
      const list = byDomain.get(p.domain) ?? [];
      list.push(p);
      byDomain.set(p.domain, list);
    }
    for (const [domain, list] of byDomain) {
      if (invariants >= DEFAULTS.maxDreamProposalsPerType) break;
      if (list.length < 2) continue;
      propose({
        type: "invariant",
        content: `Stable pattern in ${domain}: ${list.map((m) => m.content).join("; ")}`,
        derivedFrom: list.map((m) => m.id)
      });
      invariants++;
    }
    return created;
  }
  pending() {
    return [...this.proposals.values()].filter((p) => p.status === "proposed");
  }
  approve(proposalId) {
    const p = this.proposals.get(proposalId);
    if (!p || p.status !== "proposed") throw new Error(`H-MEM: no pending proposal ${proposalId}`);
    p.status = "approved";
    this.ledger.log(proposalId, "dream_approved", this.actor, { details: { type: p.type } });
    if (p.type === "domain") {
      for (const id of p.derivedFrom) {
        const m = this.store.get(id);
        if (m && p.suggestedDomain) this.store.update(id, { domain: p.suggestedDomain });
      }
      return void 0;
    }
    return this.store.add({
      content: p.content,
      type: p.type === "insight" ? "factual" : "preference",
      layer: "long_term",
      tags: [`dream:${p.type}`],
      confidence: 0.75,
      source: "dreaming",
      provenance: { origin: "dream", learnedAt: this.clock(), label: `approved ${p.type} proposal` },
      derivedFrom: p.derivedFrom
    });
  }
  reject(proposalId) {
    const p = this.proposals.get(proposalId);
    if (!p || p.status !== "proposed") throw new Error(`H-MEM: no pending proposal ${proposalId}`);
    p.status = "rejected";
    this.ledger.log(proposalId, "dream_rejected", this.actor, { details: { type: p.type } });
  }
};

// third-party/meterless-hmem/src/index.ts
var HMEM = class {
  ledger;
  store;
  mining;
  retrieval;
  conflicts;
  sleep;
  dreaming;
  clock;
  constructor(opts = {}) {
    this.clock = opts.clock ?? Date.now;
    const actor = opts.actor ?? "system";
    this.ledger = new TrustLedgerService(this.clock, opts.persistDir);
    this.store = new MemoryStoreService(this.clock, this.ledger, actor, opts.persistDir);
    this.mining = new MemoryMiningService(this.store, this.clock, opts.minerFn);
    this.retrieval = new MemoryRetrievalService(this.store, this.ledger, this.clock, actor);
    this.conflicts = new ConflictDetectionService(this.store, this.ledger, this.clock, actor);
    this.sleep = new SleepCycleService(this.store, this.ledger, this.clock, actor);
    this.dreaming = new DreamingService(this.store, this.ledger, this.clock, actor);
  }
  // Convenience surface mirroring HOW_TO_USE_H-MEM.md.
  add(input) {
    return this.store.add(input);
  }
  mine(event, text, opts) {
    return this.mining.mineInteraction(event, text, opts);
  }
  query(query, opts) {
    return this.retrieval.query(query, opts);
  }
  feedback(memoryId, kind) {
    this.retrieval.feedback(memoryId, kind);
  }
};

// src/memory.ts
function makeInvestigationMemory(result2) {
  const memory = new HMEM({ actor: "clear-close" });
  memory.add({ content: result2.policy, type: "factual", source: "closing-policy:explicit", confidence: 1, tags: ["project:clear-close", "accounting"], layer: "working" });
  const mappings = /* @__PURE__ */ new Map();
  for (const finding of result2.cases) {
    const statement = `Order or transaction ${finding.id}. Status ${finding.status}. ${finding.reason} ${finding.expected === void 0 ? "Amounts not counted pending source review." : `Gross ${finding.gross} cents; stated fees ${finding.fee} cents; posted refunds ${finding.refunds} cents; expected ${finding.expected} cents; received ${finding.observed} cents; difference ${finding.difference} cents.`}`;
    const refs = finding.evidence.map((r) => `${r.file}:${r.line}`);
    const record = memory.add({ content: statement, type: "factual", source: `recorded-finding:${finding.key}`, confidence: 1, tags: ["project:clear-close", finding.id, finding.status], layer: "working", provenance: { origin: "document", learnedAt: Date.now(), label: "Rule result from cited rows; sources not independently verified", refs } });
    mappings.set(record.id, finding);
  }
  return {
    memory,
    recall(query) {
      const found = memory.query(query, { topN: 5, threshold: 0.1 });
      const exact = [...mappings].filter(([, r]) => new RegExp(`(?:^|[^A-Z0-9_-])${r.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^A-Z0-9_-])`, "i").test(query));
      return { trace: found.trace, context: found.context, mode: exact.length ? "exact-id-tool" : "hmem-retrieval", findings: exact.length ? exact.map(([memoryId, finding]) => ({ memoryId, finding })) : found.memories.filter((r) => mappings.has(r.memory.id)).map((r) => ({ memoryId: r.memory.id, finding: mappings.get(r.memory.id), relevance: r.relevance })), ledger: memory.ledger.all() };
    }
  };
}

// src/app.ts
var $ = (selector) => document.querySelector(selector);
var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
var lang = "en";
var selected = "";
var result = null;
var notebook = null;
var live = false;
var liveClose = null;
var liveAnswer = null;
var runtimeState = "not-configured";
var working = false;
var loaded = {};
var dictionary = {
  pt: { private: "Arquivos ficam nesta aba", eyebrow: "O FECHAMENTO DO PEQUENO NEG\xD3CIO, EXPLICADO", title: "Siga a diferen\xE7a.<br>Encontre o motivo.", intro: "Os pedidos dizem uma coisa. Os recebimentos, outra.<br>Re\xFAna os registros e confira o que cada centavo explica.", sources: "01 / SUAS FONTES", bring: "Re\xFAna os tr\xEAs lados.", sourceHint: "Arquivos CSV, at\xE9 2 MB e 5.000 linhas cada. Valores em centavos inteiros e uma moeda por fechamento.", closing: "Data do fechamento", currency: "Moeda", investigate: "Investigar o fechamento \u2197", example: "Experimentar o exemplo fict\xEDcio", format: "Ver as colunas exigidas", mode: "Pr\xE9via com arquivos locais. A conex\xE3o Zetaris est\xE1 em prepara\xE7\xE3o. Nenhum modelo generativo est\xE1 ativo.", evidenceFirst: "PRIMEIRO A EVID\xCANCIA. DEPOIS A EXPLICA\xC7\xC3O.", emptyTitle: "Um fechamento claro come\xE7a<br>com a vis\xE3o completa.", emptyText: "Adicione pedidos, recebimentos e estornos, ou experimente o exemplo fict\xEDcio. O conte\xFAdo dos arquivos n\xE3o \xE9 enviado a um servidor.", step1: "Ler as fontes", step2: "Conferir os centavos", step3: "Inspecionar a evid\xEAncia", reportLabel: "02 / A INVESTIGA\xC7\xC3O", reportTitle: "O que os registros mostram.", export: "Exportar evid\xEAncias \u2193", order: "Pedido / refer\xEAncia", expected: "Esperado", received: "Recebido", difference: "Diferen\xE7a", status: "Situa\xE7\xE3o", memoryLabel: "03 / RETOME UMA CONCLUS\xC3O", memoryTitle: "Consulte o caderno de evid\xEAncias.", memoryHint: "O Meterless H-MEM recupera resultados registrados pelas regras. Refer\xEAncias exatas abrem o registro correspondente. Esta \xE9 uma busca, sem explica\xE7\xE3o gerada por modelo.", recall: "Buscar evid\xEAncias", footer: "Uma diverg\xEAncia \xE9 uma pergunta a investigar, n\xE3o a prova de um erro." }
};
var english = {};
document.querySelectorAll("[data-i]").forEach((node) => english[node.dataset.i] = node.innerHTML);
var names = { en: { orders: "Orders", settlements: "Settlements", refunds: "Refunds" }, pt: { orders: "Pedidos", settlements: "Recebimentos", refunds: "Estornos" } };
var labels = { en: { matched: "Explained", shortfall: "Shortfall", surplus: "Surplus", unsettled: "Not received", pending: "Not due yet", review: "Source review" }, pt: { matched: "Explicado", shortfall: "A menor", surplus: "A maior", unsettled: "N\xE3o recebido", pending: "Ainda a vencer", review: "Revisar fonte" } };
var t = (en, pt) => lang === "pt" ? pt : en;
var money = (amount) => amount === void 0 ? "\u2014" : new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", { style: "currency", currency: result?.currency || $("#currency").value }).format(amount / 100);
function renderSources() {
  $("#sources").innerHTML = Object.keys(schemas).map((kind) => `<label class="source"><span>${loaded[kind] ? "\u2713" : "+"}</span><strong>${names[lang][kind]}</strong><small>${esc(loaded[kind]?.name || t("Choose a CSV", "Escolher CSV"))}</small><input type="file" data-source="${kind}" accept=".csv,text/csv" aria-label="${names[lang][kind]} CSV" ${working ? "disabled" : ""}></label>`).join("");
  $("#investigate").disabled = working || !Object.keys(schemas).every((k) => loaded[k]);
  for (const id of ["example", "cutoff", "currency"]) $("#" + id).disabled = working;
}
function updateMode() {
  const state = t({ online: "assistant connected locally", offline: "assistant offline", unauthorized: "assistant connection needs renewal", "not-configured": "assistant connection pending", unavailable: "assistant unavailable" }[runtimeState] || runtimeState, { online: "assistente conectado localmente", offline: "assistente fora do ar", unauthorized: "a conex\xE3o do assistente precisa ser renovada", "not-configured": "conex\xE3o do assistente pendente", unavailable: "assistente indispon\xEDvel" }[runtimeState] || runtimeState);
  $('[data-i="private"]').textContent = live ? t("Processing on this computer", "Processamento neste computador") : t("Files stay in this tab", "Arquivos ficam nesta aba");
  $('[data-i="mode"]').textContent = live ? t(`${liveClose ? "Zetaris read the sources and the amounts passed the independent check." : "Local workspace. Sources go through Zetaris when you investigate."} Nightshift: ${state}.`, `${liveClose ? "O Zetaris leu as fontes e os valores passaram pela confer\xEAncia independente." : "Espa\xE7o local. As fontes passam pelo Zetaris ao investigar."} Nightshift: ${state}.`) : t("Browser preview \xB7 rule checks and evidence search. Run the local workspace for Zetaris and the Nightshift investigator.", "Pr\xE9via no navegador \xB7 confer\xEAncia por regras e busca de evid\xEAncias. Execute o espa\xE7o local para usar Zetaris e o investigador Nightshift.");
  $('[data-i="emptyText"]').textContent = live ? t("Try the fictional example. Source files are processed by Zetaris on this computer. Questions use the local Nightshift model.", "Experimente o exemplo fict\xEDcio. O Zetaris processa os arquivos neste computador. As perguntas usam o modelo local do Nightshift.") : t("Add the three sources, or try the fictional example. File contents are processed in this tab.", "Adicione as tr\xEAs fontes ou use o exemplo fict\xEDcio. O conte\xFAdo dos arquivos \xE9 processado nesta aba.");
  $('[data-i="memoryHint"]').textContent = live ? t("The investigator selects evidence tools through Nightshift. Every accepted finding links to inspected source rows. Amounts come from checked rules; source truth is not independently verified.", "O investigador seleciona ferramentas de evid\xEAncia pelo Nightshift. Cada conclus\xE3o aceita aponta para linhas inspecionadas. Os valores v\xEAm de regras conferidas; a veracidade das fontes n\xE3o \xE9 auditada.") : t("Meterless H-MEM retrieves recorded rule results. Exact references open the matching record. This preview uses evidence search.", "O Meterless H-MEM recupera resultados registrados pelas regras. Refer\xEAncias exatas abrem o registro correspondente. Esta pr\xE9via usa busca de evid\xEAncias.");
  $('[data-i="recall"]').textContent = working ? t("Working\u2026", "Processando\u2026") : live ? t("Investigate question", "Investigar pergunta") : t("Find evidence", "Buscar evid\xEAncias");
  $("#ask button").disabled = working;
  $("#refresh").hidden = !live;
  $("#refresh").disabled = working;
  $("#refresh").textContent = t("Check assistant connection", "Conferir a conex\xE3o do assistente");
}
async function api(path, input) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The local request failed.");
  return data;
}
function explain(row) {
  if (lang === "en") return row.reason;
  if (row.status === "review") return t(row.reason, row.reason.startsWith("Duplicate") ? "H\xE1 identificadores repetidos. Resolva os registros antes de somar este pedido." : row.reason.includes("exceed") ? "Estornos e taxas excedem o valor do pedido. Confira os registros." : "N\xE3o h\xE1 pedido correspondente. Forne\xE7a o registro que falta antes de somar.");
  return { matched: row.refunds ? "O estorno e a taxa informada explicam o recebimento l\xEDquido." : row.evidence.filter((r) => r.source === "settlements").length > 1 ? "Os recebimentos parciais somam o l\xEDquido esperado." : "A taxa informada explica a diferen\xE7a entre o bruto e o l\xEDquido.", pending: row.observed > 0 ? "Houve recebimento parcial. O saldo ainda n\xE3o venceu neste fechamento; confira novamente na data contratual." : "O vencimento contratual est\xE1 depois deste fechamento. O saldo ainda n\xE3o venceu.", unsettled: "O vencimento passou; n\xE3o h\xE1 recebimento lan\xE7ado at\xE9 a data deste fechamento nas fontes.", shortfall: "O valor recebido \xE9 menor que o esperado ap\xF3s taxas e estornos informados. A causa ainda n\xE3o foi comprovada.", surplus: "O valor recebido excede o l\xEDquido esperado. Confira o contrato e as fontes." }[row.status];
}
function evidenceRows(rows, excluded = false) {
  return rows.map((e) => `<div class="evidence-row"><strong>${esc(e.file)}:${e.line}${excluded ? ` \xB7 ${t("AFTER CLOSE \u2014 excluded", "AP\xD3S O FECHAMENTO \u2014 exclu\xEDda")}` : ""}</strong><code>${esc(e.columns.join(" | "))}</code><code>${esc(e.raw.join(" | "))}</code></div>`).join("");
}
function showDetail(id) {
  selected = id;
  const row = result.cases.find((r) => r.key === id);
  if (!row) return;
  $("#detail").innerHTML = `<section class="detail"><h3>${esc(row.id)} \xB7 ${labels[lang][row.status]}</h3><p>${esc(explain(row))}</p>${row.expected !== void 0 ? `<div class="equation">${money(row.gross)} \u2212 ${money(row.fee)} \u2212 ${money(row.refunds)} = ${money(row.expected)} ${t("expected", "esperado")}<br>${money(row.expected)} \u2212 ${money(row.observed)} = <strong>${money(row.difference)}</strong> ${t("difference", "de diferen\xE7a")}</div>` : ""}<p><strong>${t("Source evidence", "Evid\xEAncias de origem")}</strong> \xB7 ${t("physical CSV line numbers; source records are not independently verified", "linhas f\xEDsicas do CSV; a veracidade das fontes n\xE3o \xE9 verificada")}</p>${evidenceRows(row.evidence)}${row.excludedFutureRows?.length ? `<p><strong>${t("Later postings \u2014 excluded from arithmetic", "Lan\xE7amentos posteriores \u2014 exclu\xEDdos do c\xE1lculo")}</strong></p>${evidenceRows(row.excludedFutureRows, true)}` : ""}</section>`;
}
function renderReport() {
  if (!result) return;
  $("#empty").hidden = true;
  $("#report").hidden = false;
  $("#stats").innerHTML = `<div class="stat"><small>${t("Open differences, due", "Diferen\xE7as vencidas")}</small><b>${money(result.summary.unexplained)}</b></div><div class="stat"><small>${t("Orders explained", "Pedidos explicados")}</small><b>${result.summary.matched} <small>/ ${result.summary.orders}</small></b></div><div class="stat"><small>${t("Source reviews", "Revis\xF5es de fonte")}</small><b>${result.summary.review}</b></div>`;
  $("#notice").textContent = t(`Close as of ${result.cutoff}. ${result.summary.pending} not yet due. Review cases are excluded from totals. A shortfall does not establish its cause.`, `Fechamento em ${result.cutoff}. ${result.summary.pending} ainda a vencer. Casos em revis\xE3o ficam fora dos totais. Uma diferen\xE7a n\xE3o comprova sua causa.`);
  $("#rows").innerHTML = result.cases.map((r) => `<tr><td><button data-case="${esc(r.key)}" aria-label="${t("Inspect", "Inspecionar")} ${esc(r.id)}">${esc(r.id)}</button></td><td>${money(r.expected)}</td><td>${money(r.observed)}</td><td>${money(r.difference)}</td><td><span class="badge ${r.status}">${labels[lang][r.status]}</span></td></tr>`).join("");
  if (selected) showDetail(selected);
}
$("#language").onclick = () => {
  lang = lang === "en" ? "pt" : "en";
  document.documentElement.lang = lang;
  $("#language").textContent = lang === "pt" ? "EN" : "PT";
  document.querySelectorAll("[data-i]").forEach((node) => node.innerHTML = lang === "pt" ? dictionary.pt[node.dataset.i] : english[node.dataset.i]);
  $("#question").placeholder = t("Explain the shortfall in A-1002", "Explique a diferen\xE7a em A-1002");
  renderSources();
  renderReport();
  updateMode();
  $("#answer").textContent = "";
};
$("#sources").addEventListener("change", async (event) => {
  const input = event.target, file = input.files?.[0], kind = input.dataset.source;
  if (!file || !kind) return;
  try {
    if (file.size > 2e6) throw new Error(t("A source exceeds 2 MB.", "Uma fonte excede 2 MB."));
    const text = await file.text();
    const rows = parseCSV(text, kind, file.name);
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    loaded[kind] = { name: file.name, text, rows, sha256: [...new Uint8Array(hash)].map((v) => v.toString(16).padStart(2, "0")).join("") };
    result = null;
    notebook = null;
    liveClose = null;
    liveAnswer = null;
    $("#report").hidden = true;
    $("#empty").hidden = false;
    $("#error").textContent = "";
    renderSources();
  } catch (error) {
    delete loaded[kind];
    result = null;
    notebook = null;
    $("#report").hidden = true;
    $("#empty").hidden = false;
    $("#error").textContent = error.message;
    renderSources();
  }
});
$("#example").onclick = async () => {
  loaded = {};
  for (const kind of Object.keys(schemas)) {
    const text = demo[kind], name = `${kind}.csv`;
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    loaded[kind] = { name, text, rows: parseCSV(text, kind, name), sha256: [...new Uint8Array(hash)].map((v) => v.toString(16).padStart(2, "0")).join("") };
  }
  $("#cutoff").value = demo.cutoff;
  $("#currency").value = demo.currency;
  $("#error").textContent = "";
  result = null;
  notebook = null;
  $("#report").hidden = true;
  $("#empty").hidden = false;
  renderSources();
};
$("#investigate").onclick = async () => {
  if (working) return;
  working = true;
  renderSources();
  updateMode();
  $("#error").textContent = t("Reading and checking the sources\u2026", "Lendo e conferindo as fontes\u2026");
  try {
    liveClose = null;
    liveAnswer = null;
    if (live) {
      liveClose = await api("/api/close", { files: Object.fromEntries(Object.keys(schemas).map((k) => [k, { name: loaded[k].name, text: loaded[k].text }])), cutoff: $("#cutoff").value, currency: $("#currency").value });
      result = liveClose.result;
    } else result = reconcile(Object.fromEntries(Object.keys(schemas).map((k) => [k, loaded[k].rows])), { cutoff: $("#cutoff").value, currency: $("#currency").value });
    notebook = makeInvestigationMemory(result);
    selected = "";
    $("#answer").textContent = "";
    $("#detail").textContent = "";
    $("#error").textContent = "";
    renderReport();
  } catch (error) {
    result = null;
    notebook = null;
    liveClose = null;
    $("#report").hidden = true;
    $("#empty").hidden = false;
    $("#error").textContent = error.message;
  } finally {
    working = false;
    renderSources();
    updateMode();
  }
};
for (const id of ["cutoff", "currency"]) $("#" + id).addEventListener("change", () => {
  result = null;
  notebook = null;
  liveClose = null;
  liveAnswer = null;
  $("#report").hidden = true;
  $("#empty").hidden = false;
});
$("#rows").onclick = (event) => {
  const button = event.target.closest("[data-case]");
  if (button) showDetail(button.dataset.case);
};
$("#ask").onsubmit = async (event) => {
  event.preventDefault();
  if (!notebook || working) return;
  if (live) {
    working = true;
    renderSources();
    updateMode();
    $("#answer").textContent = t("Nightshift is selecting and inspecting evidence. A cold model can take a few minutes.", "O Nightshift est\xE1 selecionando e inspecionando evid\xEAncias. A primeira execu\xE7\xE3o pode levar alguns minutos.");
    try {
      liveAnswer = await api("/api/ask", { run: liveClose.run, question: $("#question").value });
      runtimeState = "online";
      const checkNames = { request_processor_statement: t("Request the processor statement", "Solicitar o extrato da operadora"), check_fee_contract: t("Check the fee contract", "Conferir o contrato de taxas"), check_settlement_schedule: t("Check the settlement schedule", "Conferir o prazo de recebimento"), resolve_source_conflict: t("Resolve the source conflict", "Resolver o conflito da fonte"), recheck_on_due_date: t("Recheck on the contractual due date", "Conferir na data contratual"), retain_source_rows: t("Retain the cited records", "Guardar os registros citados") };
      $("#answer").innerHTML = liveAnswer.findings.map((finding) => `<p><strong>${esc(finding.id)}</strong> \xB7 ${esc(explain(finding))} ${finding.difference === void 0 ? "" : `<b>${money(finding.difference)}</b>`}<br><small>${finding.evidence.map((row) => esc(`${row.file}:${row.line}`)).join(" \xB7 ")}</small><br>${t("Next check:", "Pr\xF3xima confer\xEAncia:")} ${finding.nextChecks.map((check) => esc(checkNames[check] || check)).join("; ")} <button class="quiet" data-case="${esc(finding.key)}">${t("Inspect rows", "Ver linhas")}</button></p>`).join("") + `<details><summary>${t("View tool trail and model receipts", "Ver ferramentas e comprovantes do modelo")}</summary><pre>${esc(JSON.stringify({ trace: liveAnswer.trace, receipts: liveAnswer.receipts, policy: liveAnswer.explanationPolicy }, null, 2))}</pre></details>`;
    } catch (error) {
      liveAnswer = null;
      $("#answer").textContent = error.message;
    } finally {
      working = false;
      renderSources();
      updateMode();
    }
    return;
  }
  const answer = notebook.recall($("#question").value);
  $("#answer").innerHTML = answer.findings.length ? answer.findings.map(({ finding }) => `<p><strong>${esc(finding.id)}</strong> \xB7 ${esc(explain(finding))} ${finding.difference === void 0 ? "" : `<b>${money(finding.difference)}</b>`} <button class="quiet" data-case="${esc(finding.key)}">${t("Inspect rows", "Ver linhas")}</button></p>`).join("") : `<p>${t("No sufficiently relevant finding. Try an exact order reference.", "Nenhuma conclus\xE3o suficientemente relevante. Tente a refer\xEAncia exata do pedido.")}</p>`;
  $("#answer").innerHTML += `<details><summary>${t("View retrieval trace", "Ver rastro da busca")}</summary><pre>${esc(JSON.stringify({ engine: "Meterless H-MEM", mode: answer.mode, trace: answer.trace, auditEntries: answer.ledger.length }, null, 2))}</pre></details>`;
};
$("#answer").onclick = (event) => {
  const button = event.target.closest("[data-case]");
  if (button) showDetail(button.dataset.case);
};
$("#export").onclick = () => {
  if (!result) return;
  const packet = { ...result, generatedAt: (/* @__PURE__ */ new Date()).toISOString(), sourceMode: liveClose ? "zetaris-local-jdbc" : "browser-csv-preview", generativeModel: !!liveAnswer?.modelUsed, integrations: { meterless: liveAnswer ? "Nightshift local Runtime + H-MEM" : "H-MEM reference in-memory; no model used", zetaris: liveClose?.zetaris || "not connected in browser preview" }, sources: liveClose?.manifest || Object.fromEntries(Object.keys(loaded).map((k) => [k, { name: loaded[k].name, sha256TextUTF8: loaded[k].sha256 }])), investigation: liveAnswer, ledger: notebook.memory.ledger.all() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `clear-close-${result.cutoff}.json`;
  link.click();
  URL.revokeObjectURL(url);
};
$("#schema").textContent = Object.entries(schemas).map(([kind, columns]) => `${kind}.csv
${columns.join(",")}`).join("\n\n");
renderSources();
updateMode();
async function refreshConnection() {
  await fetch("./api/status").then(async (response) => {
    if (!response.ok) return;
    const status = await response.json();
    if (status.live) {
      live = true;
      runtimeState = status.nightshift.state;
      updateMode();
    }
  }).catch(() => {
  });
}
$("#refresh").onclick = refreshConnection;
refreshConnection();
