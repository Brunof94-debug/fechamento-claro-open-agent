# Readiness record

Started 2026-10-22T00:34:31Z (21 October, 21:34 Brasília), after the official build window opened. Updated 22 October 2026.

| Requirement | Observed state |
|---|---|
| Event registration | Portal explicitly confirmed **Registration complete** on 22 October. Registration is distinct from project submission. |
| Entrant | Bruno Fernandes; Accounting graduate, intermediate programming, Brazil. Manual profile used after LinkedIn import failed. No employment history was invented. |
| Team | **Fechamento Claro**, solo, **FORMED**, 1/1. Invitations paused. Team ID `01a16132-49df-7697-a2a4-0851c52b8e49`. |
| Required social steps | Official GenAI Works LinkedIn and X profiles followed; both confirmed by the event portal. |
| Project submission | **Not started. No submission receipt.** Demo, public repository, slides and video remain in preparation. |
| Cursor | Actual authenticated Ask-mode review completed using CLI `2026.10.19-6bbf2c4`. Resulting fixes and scope: [CURSOR-REVIEW.md](CURSOR-REVIEW.md). |
| Zetaris | Genuine local Docker platform and official JDBC driver `2.4.3.1-7eff043`. Three CSV sources registered in the Lightning catalog. All source rows read back, cross-source SQL executed, and every counted amount matched the independent cent calculation. Sanitized proof: `evidence/zetaris-close.json`. |
| Meterless H-MEM | Actual Apache-2.0 upstream reference; in-memory retrieval, provenance and audit exercised. This alone does not satisfy the local Runtime requirement. |
| Nightshift | Official Windows edition `1.2.1` installed; GGUF models detected. External Runtime connection and a successful model request are **pending**. Provider and bounded investigator implemented; actual generative integration is not yet claimed. |
| Automated checks | 18 tests passed: integer cents, source consistency, dates, duplicates, H-MEM, Runtime credential handling, refusal of uninspected model citations. Stub-based model tests do not prove real Runtime execution. |
| NVIDIA bonus | Not claimed. A CUDA-capable GPU is present, but no Nemotron execution has been established. |
| Costs | Free local resources only. No paid API, AWS deployment, subscription or billing activated. |

## Runtime constraints and recovery

Docker Desktop 4.90.0 required recovery from stale Windows runtime socket directories. Only scoped runtime socket parents were renamed to recoverable backups while Docker was stopped. No project volumes, WSL distributions or other users' Docker data were deleted.

The native control helper returned an image of a different application for Nightshift. Native inputs were stopped. Manual activation of the already downloaded Llama 3.2 1B was requested. The local connection is not verified until a real request succeeds.

## Official sources

- [Current event and rules](https://hackathon.genai.works/event/open-agent-hackathon-2026#rules)
- [Team dashboard](https://hackathon.genai.works/team/019fd164-82b9-7382-a536-d9093c576ed2/01a16132-49df-7697-a2a4-0851c52b8e49)
- [Zetaris installation](https://zetaris.github.io/getting-started/docs/install/updated_zetaris_installation_guide.html)
- [Zetaris SQL registration syntax](https://kbase.zetaris.com/knowledge/sql-manual)
- [Cursor CLI](https://cursor.com/docs/cli/overview)
- [Meterless source](https://github.com/Meterless/Meterless), pinned at `1742dec56a66e58eef9dda2d2b865823758ca8cd`

The current Participant Setup Guide requires genuine local Zetaris, a locally running Meterless engine with Nightshift as primary generative provider, and actual Cursor development. A static preview, H-MEM import or planned adapter is not substituted for those requirements.
