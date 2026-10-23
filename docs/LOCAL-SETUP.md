# Local execution

The browser preview performs rule checks and H-MEM retrieval. The complete investigator uses genuine local Zetaris and Meterless Nightshift, without a cloud-model fallback.

## Prerequisites

- Node.js 22+, Python 3.11+, a Java 17 runtime and JPype1.
- Official Zetaris platform distribution and included JDBC driver, obtained under the user's own free entitlement. Licensed vendor binaries and registry credentials are excluded from this repository.
- Official Nightshift desktop edition with an active local text model. Final live scenarios: Windows edition 1.2.1, Llama 3.1 8B Instruct Q4_K_M, 4k context and one slot. Verify the model checksum against its publisher, not just the filename or byte count; see `evidence/model-integrity.json`.
- Local disk and memory for both engines. This 16 GB machine uses a Zetaris driver heap of 2 GB, two local cores, and API maximum heap of 1 GB. Respect the Runtime's memory-admission refusal; do not bypass it. If memory is insufficient, finish the Zetaris close first, stop only the project's query services, and then run Nightshift against the retained validated close in the same local server session.

## Zetaris

1. Follow the official local installation guide. Keep credentials private. Bind local UI, API and JDBC ports to loopback. No AWS resources are needed.
2. Store this project's local administrator email/password in ignored `.runtime/zetaris-local-admin.json`. The browser never receives this file.
3. The JDBC helper currently expects the official driver in `.runtime/zetaris/zetaris-platform/jdbc/`, one verified runtime's `jvm.dll` under `.tools/temurin-jre/`, and JPype1 under `.tools/python-jdbc/`. Configure `FECHAMENTO_PYTHON` to the appropriate Python executable. These are local installation paths, not bundled dependencies.
4. Create the file-source container `FECHAMENTO_CLARO` through the official UI or documented `CREATE LIGHTNING DATABASE FECHAMENTO_CLARO` command.
5. Set `FECHAMENTO_DATA_DIR` in the private vendor `.env` to this project's absolute `.runtime/zetaris-data` path. `compose.project.yml` mounts only that directory, read-only, in both driver and API at `/home/zetaris/customer-data/shared/fechamento`.
6. Start the vendor Compose file with this overlay and project name `fechamento-claro-zetaris`. Keep other projects and volumes separate. The helper registers a fresh namespaced source set per run using documented `CREATE LIGHTNING FILESTORE TABLE ... FROM FECHAMENTO_CLARO FORMAT CSV OPTIONS (...)`.

Sources are strictly parsed before staging. Each staging row retains the physical CSV line, exact original cells in base64 JSON, and source text SHA-256. After Zetaris reads the records, the app compares them with the validated snapshot and independently checks every counted SQL total. A disagreement stops the close.

No bank, processor or customer account is connected. Source truth is not independently audited. Shared demonstrations use fictional records only.

## Nightshift

1. In Nightshift open NIGHT → Lanes. Add a lane using an installed text model if none is configured: a downloaded GGUF alone does not create a serving lane. The final setup uses the verified Llama 3.1 8B model, 4k context and one slot, with autostart disabled. Click Start and wait for Ready. Keep the Runtime endpoint on loopback.
2. Authorize this project to use the existing local `proxy-token`. Never paste tokens into public files, screenshots, issues or frontend fields.
3. Run `node scripts/connect-nightshift.mjs <absolute-path-to-existing-proxy-token>`. This saves only the private connection path in ignored `.runtime/meterless-client.json`; it neither creates a key nor changes endpoint security.
4. Run `npm run check:nightshift`. Success must show authenticated `/v1/models`, wrong-token rejection, and an actual `meterless/local` text response.
5. In Console → Apps, bind **Fechamento Claro** to **Local**. Nightshift may otherwise inherit the cockpit's Auto setting on first contact, overriding the client's requested routing mode. Verify `routedMode: local`, `winningRoute.kind: local` and `privacy.path: local-only` in the returned receipt.

The provider restricts destinations to loopback, sends the real Bearer token, `meterless-app: fechamento-claro`, `meterless-scope: user` and `meterless-tier-split: off`, and allows a 180-second cold-start timeout. It requests `meterless/local` and rejects returned execution metadata that identifies a non-local winner. Keep the Runtime app binding on Local; requesting a mode alone does not override a saved Nightshift app policy.

## Run

From this project directory: `npm ci`, `npm test`, `npm run build`, then `npm run live`. Open `http://127.0.0.1:4341/`.

The loopback server accepts same-origin JSON requests, keeps credentials server-side, and exposes bounded close/investigation actions rather than arbitrary SQL. Start with the fictional example. Source snapshots and local investigation logs stay in ignored `.runtime/`.

`npm run dev` serves only the static preview and does not execute Zetaris or Nightshift integrations.

## Limits

- Three strict CSV schemas; one currency; 5,000 records and 2 MB per file.
- Fees are explicitly supplied and are not assumed refundable.
- Conflicting identifiers quarantine an order; no automatic duplicate selection.
- No bank APIs, exchange rates, OCR, writebacks or payment movement.
- H-MEM is in-memory; a browser reload starts a new notebook.
- At most six local-model turns, using a bounded JSON Schema for the choice. A bare JSON integer is also accepted and range checked. Inspection options come only from retrieved H-MEM findings; finish options contain only already inspected cases. A question naming an exact known reference must finish with that reference, not another case. Malformed or unavailable choices are refused. Failures are reported, without accepting a fabricated explanation.
- The model selects evidence tools. Rules produce final amounts, citations, findings and allowed next checks. This limits narrative but preserves traceability.
- Local snapshots accumulate and require deliberate owner cleanup after evidence retention; the app does not silently delete prior runs.
