# Actual Cursor development review

On 2026-10-22 UTC (2026-10-21 in Brazil), Cursor CLI
`2026.10.19-6bbf2c4` completed an authenticated, read-only Ask-mode review
of `src/core.mjs`, `src/memory.ts` and `tests/*.test.ts`.
No paid plan, trial or billing was activated. The CLI did not modify files or
execute tests. The review prompt excluded private runtime, tool and credential
directories. This documents actual Cursor use; it does not claim Cursor authored
the entire application.

Material findings and resulting changes:

- Future postings appeared among calculation citations even though their amounts
  were excluded. Calculation evidence and later postings are now separate.
- Reconciliation trusted caller-supplied amounts. It now validates integer cents
  and checks every field against its retained source row before arithmetic.
- Duplicate orphan IDs produced separate reviews without identifying the
  duplicate. They now produce one grouped review with all conflicting evidence.
- Order counts used physical rows. They now count distinct order references.
- Orphans posted after the close appeared in current reviews. They now remain in
  the separate later-posting list until their date.
- Identifier substring lookup could choose a longer reference. Exact lookup now
  requires identifier boundaries; a prefix falls back to ordinary H-MEM recall.
- Memory source labels implied independent verification. Labels now describe a
  recorded rule result, explicitly without independent source verification.

Product decisions after review:

- An early partial receipt remains not due until the supplied contractual date;
  its remaining balance and partial-receipt explanation are visible. A shortfall
  is not asserted prematurely. Receipts above the expected total are flagged as
  surplus even before the due date.
- Whole-order quarantine for conflicting IDs is deliberate. No convenient copy
  is silently selected from conflicting records.
- Contract totals remain available, with explicit due/not-due subtotals. The
  displayed open-difference total includes only due orders.
- Fees are not assumed refundable. This is an explicit configurable-in-future
  product limitation, not a claim about every payment contract.

Validation after these changes: 15 meaningful automated tests passed, including
source/evidence consistency, one-cent sensitivity, date boundaries, duplicate
quarantine and exact-reference recall. Browser build also succeeded.

Review limitations: Cursor reviewed only the named files; its examples were
synthetic and it did not run tests. The review did not establish completed
Zetaris, Nightshift or NVIDIA integration, nor contest eligibility.
