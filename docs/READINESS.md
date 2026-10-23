# Readiness record

Started 2026-10-22T00:34:31Z (21 October, 21:34 Brasília), after the official build window opened. Updated 23 October 2026.

| Requirement | Observed state |
|---|---|
| Event registration | Portal explicitly confirmed **Registration complete** on 22 October. Registration is distinct from project submission. |
| Entrant | Bruno Fernandes; Accounting graduate, intermediate programming, Brazil. Manual profile used after LinkedIn import failed. No employment history was invented. |
| Team | **Fechamento Claro**, solo, **FORMED**, 1/1. Invitations paused. Team ID `01a16132-49df-7697-a2a4-0851c52b8e49`. |
| Required social steps | Official GenAI Works LinkedIn and X profiles followed; both confirmed by the event portal. |
| Project submission | Existing track draft saved with the narrated 2m27 video and six-slide pitch attached. **Submitted 0/1** at the latest portal check; no final receipt yet. |
| Public source and preview | [Selected GitHub account and source](https://github.com/Brunof94-debug/fechamento-claro-open-agent); [static browser preview](https://brunof94-debug.github.io/fechamento-claro-open-agent/). |
| Cursor | Actual authenticated Ask-mode review completed using CLI `2026.10.19-6bbf2c4`. Resulting fixes and scope: [CURSOR-REVIEW.md](CURSOR-REVIEW.md). |
| Zetaris | Genuine local Docker platform and official JDBC driver `2.4.3.1-7eff043`. Three CSV sources registered in the Lightning catalog. All source rows read back, cross-source SQL executed, and every counted amount matched the independent cent calculation. Sanitized proof: `evidence/zetaris-close.json`. |
| Meterless H-MEM | Actual Apache-2.0 upstream reference; in-memory retrieval, provenance and audit exercised. This alone does not satisfy the local Runtime requirement. |
| Nightshift | Official Windows edition `1.2.1`; authenticated model discovery, wrong-token rejection and the READY known-answer test passed. Verified Llama 3.1 8B chose H-MEM search, source-case inspection and completion for A-1002, A-1006 and A-1007. Sanitized receipts are in `evidence/nightshift-connection.json`, `evidence/nightshift-investigation.json` and `evidence/nightshift-scenarios.json`; no token values are included. |
| Automated checks | 19 tests passed: integer cents, source consistency, dates, duplicates, H-MEM, Runtime credential handling, unavailable tool-choice rejection and refusal of a cloud winning route. Stub-based model tests do not prove real Runtime execution. |
| Full live check | `npm run check:workflow` passed against both running engines: fresh source registration, seven Zetaris queries, three Nightshift model turns and the correct A-1002 finding. Complete sanitized proof: `evidence/live-workflow.json`. |
| NVIDIA bonus | Not claimed. A CUDA-capable GPU is present, but no Nemotron execution has been established. |
| Costs | Free local resources only. No paid API, AWS deployment, subscription or billing activated. |

## Runtime constraints and recovery

Docker Desktop 4.90.0 required recovery from stale Windows runtime socket directories. Only scoped runtime socket parents were renamed to recoverable backups while Docker was stopped. No project volumes, WSL distributions or other users' Docker data were deleted.

Nightshift initially refused model admission during low physical memory. The final Llama 3.1 8B lane uses 4k context, one slot and autostart off. The project's Zetaris driver uses a 2 GB heap and two local cores; the API uses a 1 GB maximum heap. Source-query and model steps can run in separate phases on this 16 GB Windows machine, retaining the validated close in the local server session.

The initial 1B model was unreliable at selecting structured tools. The first installed 8B file also failed SHA-256 verification against the exact publisher repository used by Nightshift. It was retained privately and replaced by a freshly downloaded, checksum-verified file. Final model provenance is recorded in `evidence/model-integrity.json`. Connection checks now require the exact READY response, rather than accepting arbitrary text.

The final protocol offers bounded indexed tool choices and limits inspection to H-MEM retrieval results. Exact references in a question must be included in the accepted result. Only checked rules supply returned amounts, citations and next checks. The app requests `meterless/local`; the Nightshift Apps panel is also bound to Local. Receipts retain both the requested route and actual routed mode, model and local execution path.

## Official sources

- [Current event and rules](https://hackathon.genai.works/event/open-agent-hackathon-2026#rules)
- [Team dashboard](https://hackathon.genai.works/team/019fd164-82b9-7382-a536-d9093c576ed2/01a16132-49df-7697-a2a4-0851c52b8e49)
- [Zetaris installation](https://zetaris.github.io/getting-started/docs/install/updated_zetaris_installation_guide.html)
- [Zetaris SQL registration syntax](https://kbase.zetaris.com/knowledge/sql-manual)
- [Cursor CLI](https://cursor.com/docs/cli/overview)
- [Meterless source](https://github.com/Meterless/Meterless), pinned at `1742dec56a66e58eef9dda2d2b865823758ca8cd`

The current Participant Setup Guide requires genuine local Zetaris, a locally running Meterless engine with Nightshift as primary generative provider, and actual Cursor development. A static preview, H-MEM import or planned adapter is not substituted for those requirements.
