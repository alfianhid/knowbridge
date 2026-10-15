# KnowBridge - Google AI Builder Cup 2026

Connecting knowledge to confident decisions. Singapore-first evidence catalog for Google Workspace SMEs.

## Current status

Phase 1 implements a bounded synthetic source catalog, durable ingestion and provenance. Default import contains 16 Harbour documents and 2 sheets. The explicit evaluation profile contains 55 sources across eight projects and both launch-readiness policy revisions; see [retrieval setup](docs/RETRIEVAL.md). Source IDs, historical recorded/effective dates, literal text, chunks and SHA-256 checksums are retained.

Local development uses durable files under ignored `.data/sources`. Cloud Run requires Firestore. Ingestion and catalog/detail reads use the same store. Imports survive restart, concurrent retries skip unchanged records, and metadata changes refresh stored records. Failed imports report actual failure counts.

Phase 2 adds `/api/ask`, an Ask UI, Gemini 768-dimensional embeddings, scoped Firestore vector retrieval and structured Gemini answers with verified literal citations. Local mode is deterministic lexical evidence lookup with no AI synthesis. Cloud Run requires Vertex AI and Firestore; failures never switch to local responses. Saved decision APIs remain Phase 3. Live cloud Harbour and absent-information checks passed on 2026-10-15; see [cloud results](docs/CLOUD-PHASE2-RESULTS.md). Broader model accuracy and deployment are not claimed.

Synthesized answers now pass a separate structured semantic review after citation checks. Eight live semantic regressions passed. The full benchmark recorded 9/12 and 10/12 automated passes, with all five failed-case retries passing; [per-attempt evidence](docs/EVALUATION-RESULTS-2026-10-15.md) preserves failures. This does not replace human review. Current evidence, full-evaluation outcomes and remaining acceptance gates are linked from [readiness](docs/READINESS.md).

## Run locally

Requires Node.js 22.18+ and Python 3.11+. On PowerShell use `npm.cmd` if script policy blocks `npm.ps1`.

```powershell
npm.cmd ci
python scripts/verify_seed.py
$env:KNOWBRIDGE_STORE="file"
$env:KNOWBRIDGE_RETRIEVAL="local"
npm.cmd run ingest:local
npm.cmd run dev
```

Open http://localhost:3000. Empty storage shows an empty catalog until ingestion runs. The trusted local ingestion CLI does not open an unauthenticated HTTP mutation path.

Keep both mode variables set in the same shell for ingestion and the app. Shell settings override Next.js `.env` settings, including an existing cloud profile. `ingest:local` is a script name, not a forced storage backend. For Firestore/Vertex CLI commands, load the cloud profile explicitly as shown in [retrieval setup](docs/RETRIEVAL.md).

Ask “Can Project Harbour launch on 1 Nov?” to inspect client expectations, newer QA forecasts, pending security and decision records. Local responses quote evidence; they do not generate recommendations. Absent evidence returns `insufficient_evidence`.

For cloud settings, vector schema, the exact one-time index command and indexing instructions, see [Phase 2 setup](docs/RETRIEVAL.md). `npm.cmd run index:vectors` is a trusted operator step after cloud source ingestion. Health reports configuration readiness, never verified connectivity.

If the Python launcher cannot locate the user installation:
```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe" scripts/verify_seed.py
```

## Verify

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd audit
```

Browser tests require a production build and the local 18-source import. Playwright starts its own local server. Tests cover mobile reflow, keyboard access, forced colors, source selection, retry and axe checks. These checks do not certify complete accessibility. Bounded real retrieval has recorded smoke evidence; the 12-case automated run is recorded, while single-run reliability and human semantic review remain open. See [current readiness](docs/READINESS.md).

## Data and hero facts

The complete reproducible dataset contains 168 fictional documents, 24 sheets, 1,904 rows, 8 projects, 30 invented staff and 12 gold evaluation cases. Apps Script native Workspace seeding is optional; see `apps-script/README.md`.

Harbour customer target: 2026-11-01 (`HBR-DOC-02`). QA forecast: 2026-11-11, recorded 2026-10-10 (`HBR-DOC-04`). Security approval: PENDING (`HBR-DOC-06`). No revised full-release commitment or pilot approval exists (`HBR-DOC-09`, `HBR-DOC-15`). A forecast/readiness mismatch is not proof a customer expectation was never made.

**All organizations, people, emails and records are fictional.** No customer data, legal approval or production certification is claimed.

## Access and cloud setup

Public reads expose only `demo-north-quay` synthetic records. Caller headers cannot select private tenants. `POST /api/ingest` requires a verified, revocation-checked Firebase ID token with `knowbridgeAdmin:true` and `knowbridgeTenant:"demo-north-quay"`. Static ingestion tokens are no longer supported. Body size is capped at 16 KiB; each admin can ingest five times per minute. The shared store enforces the ingestion quota.

Set cloud variables from `.env.example`; use ADC locally and the assigned managed service identity on Cloud Run. Never commit keys or bake them into images. Both `secrets/` and `.secrets/` are excluded from Git and Docker. See `docs/DEPLOYMENT.md` for required API/database/IAM setup.

The container uses `npm ci`, standalone Next output and a non-root runtime. A nonce-based CSP protects production scripts. Dependency overrides are pinned and must be rechecked on upgrades.

## Workflow and tracking

[Audit tracker](https://github.com/alfianhid/knowbridge/issues/21) records findings and verification. Local plan/results: `docs/AUDIT-REMEDIATION-PLAN.md`, `docs/AUDIT-TRACKER.md`.

Resolve Phase 1 gates before `prompts/02-RETRIEVAL.md`. Then follow the staged prompt sequence. P1 Picker must wait until P0 works.

The original planning documents specify team formation on 2026-10-14, internal submission on 2026-10-17 and final submission on 2026-10-18. The user confirmed the registration checkpoint; exact competition-dashboard cutoff remains a dashboard fact.
