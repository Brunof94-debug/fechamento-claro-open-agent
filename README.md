# Fechamento Claro / Clear Close

Investigate a settlement difference and trace every cent to its source row.

New project for the **Open Agent Hackathon 2026**, primary track **The Agent That Can Explain Why**. Work began on 21 October 2026 after 21:00 America/Sao_Paulo, inside the official build window. The earlier October research contained only an idea, not original product code.

## Current state

In development. Event registration is confirmed and the solo team is formed. **No project submission has been made.**

The intended product compares order, settlement and refund sources; investigates differences; preserves exact source citations; and requests missing information rather than inventing an explanation. Demonstration data is fictional. An accounting discrepancy is not proof of misconduct.

The genuine local Zetaris engine registered and queried all three sources, joined their totals, and matched the independent integer-cent reconciliation. Actual Cursor review and resulting fixes are documented in [docs/CURSOR-REVIEW.md](docs/CURSOR-REVIEW.md). Meterless H-MEM is exercised; the installed Nightshift desktop Runtime still needs its first successful local model request. The investigator and provider are implemented but are not represented as fully integrated yet.

Required sponsor work and proof limits are tracked in [docs/READINESS.md](docs/READINESS.md). Sanitized execution evidence is in `evidence/zetaris-close.json`.

## Local development

Node.js 22 or later. `npm ci`, `npm test`, `npm run build`, then `npm run dev` for the static browser preview.
The preview binds to loopback only. It requires no paid API. For genuine sponsor integrations, follow [docs/LOCAL-SETUP.md](docs/LOCAL-SETUP.md) and run `npm run live`.

18 automated tests pass. Stub-based provider/agent checks validate refusal behavior; actual engine execution is documented separately and never inferred from these tests.

## Event dates, verified at the start

- Build opens: 22 October 00:00 UTC = 21 October 21:00 Brasília.
- Registration closes: 22 October 23:59 UTC = 22 October 20:59 Brasília.
- Submission closes: 27 October 23:45 UTC = 27 October 20:45 Brasília.
- Results: 6 November 16:00 UTC = 6 November 13:00 Brasília.

[Official event and rules](https://hackathon.genai.works/event/open-agent-hackathon-2026#rules).
