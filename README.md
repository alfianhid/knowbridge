# KnowBridge - Google AI Builder Cup 2026

Connecting knowledge to confident decisions. Singapore-first evidence catalog for Google Workspace SMEs.

## Current status

Phase 1 implements a bounded synthetic source catalog, durable ingestion and provenance. The active batch contains 16 Harbour documents and 2 sheets. Source IDs, historical recorded/effective dates, literal text, chunks and SHA-256 checksums are retained.

Local development uses durable files under ignored `.data/sources`. Cloud Run requires Firestore. Ingestion and catalog/detail reads use the same store. Imports survive restart, concurrent retries skip unchanged records, and metadata changes refresh stored records. Failed imports report actual failure counts.

Gemini, embeddings, vector retrieval, Q&A and saved decision APIs are pending Phase 2/3. Health truthfully returns `aiEnabled:false`. No model accuracy or cloud deployment is claimed.

## Run locally

Requires Node.js 22.18+ and Python 3.11+. On PowerShell use `npm.cmd` if script policy blocks `npm.ps1`.

```powershell
npm.cmd ci
python scripts/verify_seed.py
npm.cmd run ingest:local
npm.cmd run dev
```

Open http://localhost:3000. Empty storage shows an empty catalog until ingestion runs. The trusted local ingestion CLI does not open an unauthenticated HTTP mutation path.

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

Browser tests require a production build and the local 18-source import. Playwright starts its own local server. Tests cover mobile reflow, keyboard access, forced colors, source selection, retry and axe checks. These checks do not certify complete accessibility. AI benchmark semantics remain pending real retrieval.

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
