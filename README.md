# Fechamento Claro / Clear Close

Investigate a settlement difference and trace every cent to its source row.

New project for the **Open Agent Hackathon 2026**, primary track **The Agent That Can Explain Why**. Work began on 21 October 2026 after 21:00 America/Sao_Paulo, inside the official build window. The earlier October research contained only an idea, not original product code.

## Current state

Working local prototype, **submitted on 23 October 2026** to **The Agent That Can Explain Why**. The event portal confirmed **Submitted 1/1**. Registration and the solo team are also confirmed. See [docs/READINESS.md](docs/READINESS.md) and [the submission dashboard](https://hackathon.genai.works/submissions?hackathon_id=019fd164-82b9-7382-a536-d9093c576ed2).

The product compares order, settlement and refund sources, preserves exact source citations, and suggests the next evidence to request. Demonstration data is fictional. An accounting discrepancy is not proof of misconduct.

The genuine local Zetaris engine registers and queries all three sources, joins their totals, and matches the independent integer-cent reconciliation. Actual Cursor review and resulting fixes are documented in [docs/CURSOR-REVIEW.md](docs/CURSOR-REVIEW.md). The Nightshift investigator executed real local Llama 3.1 8B requests, selected H-MEM retrieval, inspected source rows, and finished the A-1002 investigation with the checked R$10 difference. Additional live scenarios returned the source conflict for A-1006 and the not-yet-due status of A-1007. Receipts identify local execution. Model-generated amounts, causes and citations are never accepted as facts.

Required sponsor work and proof limits are tracked in [docs/READINESS.md](docs/READINESS.md). Sanitized execution evidence is in `evidence/zetaris-close.json`, `evidence/nightshift-connection.json`, `evidence/nightshift-investigation.json` and `evidence/nightshift-scenarios.json`.

`npm run check:workflow` completed a fresh source registration and seven actual Zetaris queries, followed by three local Nightshift model turns. Its sanitized complete receipt is `evidence/live-workflow.json`. This check requires the private engine setup and has no mock fallback.

[Watch the narrated demonstration](presentation/fechamento-claro-demo.mp4) · [View the six-slide pitch](presentation/fechamento-claro-open-agent-2026-10-23-v2.pptx)

[Open the browser preview](https://brunof94-debug.github.io/fechamento-claro-open-agent/). It runs CSV rules and H-MEM in the browser. The complete Zetaris/Nightshift workflow runs on the local workspace described below; GitHub Pages cannot host those engines.

## Local development

Node.js 22 or later. `npm ci`, `npm test`, `npm run build`, then `npm run dev` for the static browser preview.
The preview binds to loopback only. It requires no paid API. For genuine sponsor integrations, follow [docs/LOCAL-SETUP.md](docs/LOCAL-SETUP.md) and run `npm run live`.

19 automated tests pass. Stub-based provider/agent checks validate refusal behavior; actual engine execution is documented separately and never inferred from these tests.

## How the investigator works

1. Strictly validate three source snapshots and retain every original row and physical CSV line.
2. Register fresh namespaced Zetaris sources, query all records and join the amounts. Refuse a close if source provenance or any counted total disagrees with the independent cent calculation.
3. Ask Nightshift to choose a search subject. Execute real Meterless H-MEM retrieval, then offer only retrieved cases for inspection.
4. Ask the model to select case inspection and completion from a bounded set of available actions. Unknown choices are refused. Only inspected findings can reach the answer.
5. Render checked calculations, original source rows, model receipts and next checks. Export an evidence bundle with the actual execution trail.

This is a guided investigator, not an unrestricted agent. The small local model selects tools and evidence; it does not write an unchecked financial narrative. H-MEM is in memory for the current run. Only seven fictional orders are demonstrated; no production accuracy or time-saving claim is made.

## Event dates, verified at the start

- Build opens: 22 October 00:00 UTC = 21 October 21:00 Brasília.
- Registration closes: 22 October 23:59 UTC = 22 October 20:59 Brasília.
- Submission closes: 27 October 23:45 UTC = 27 October 20:45 Brasília.
- Results: 6 November 16:00 UTC = 6 November 13:00 Brasília.

[Official event and rules](https://hackathon.genai.works/event/open-agent-hackathon-2026#rules).
