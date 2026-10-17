# KnowBridge - Google AI Builder Cup 2026

Connecting knowledge to confident decisions. Singapore-first evidence catalog for Google Workspace SMEs.

## Current status

Phase 5 shipping work is recorded in [Phase 5 results](docs/PHASE5-RESULTS.md): recorded 12-case benchmark artifacts (full runs and separate focused retries), a Cloud Run permission review with live mutation probes, the public-repo confirmation, exact evaluation/deploy instructions, the deck PDF and the demo video script, plus the artifact-URL checklist and unresolved issues. Full-suite benchmark reliability under intermittent provider-side failures remains open and is reported honestly there.

Phase 1 implements a bounded synthetic source catalog, durable ingestion and provenance. Default import contains 16 Harbour documents and 2 sheets. The explicit evaluation profile contains 55 sources across eight projects and both launch-readiness policy revisions; see [retrieval setup](docs/RETRIEVAL.md). Source IDs, historical recorded/effective dates, literal text, chunks and SHA-256 checksums are retained.

Local development uses durable files under ignored `.data/sources`. Cloud Run requires Firestore. Ingestion and catalog/detail reads use the same store. Imports survive restart, concurrent retries skip unchanged records, and metadata changes refresh stored records. Failed imports report actual failure counts.

Phase 2 adds `/api/ask`, Gemini 768-dimensional embeddings, scoped Firestore vector retrieval and structured answers with verified literal citations. Local mode is deterministic lexical evidence lookup with no AI synthesis. Phase 3 adds protected brief creation, saved list/detail, review acknowledgement and source inspection. The deployed app and one authenticated Harbour brief create/retry/list/reopen/source verification passed; see [current readiness](docs/READINESS.md) and [deployed brief evidence](docs/CLOUD-BRIEF-VERIFICATION-2026-10-16.md). This does not establish full benchmark reliability, broad model accuracy or production readiness.

Synthesized answers pass a structured semantic gate after citation checks. Eight live adversarial regressions passed. The full benchmark runs recorded 9/12 and 10/12 automated passes; focused retries passed the failed cases, but do not convert either full run into a pass. You reported successful human semantic review of all 12 cases and manual accessibility checks on 2026-10-16; reviewer and environment details were not recorded. The deployed brief still has `reviewedByHuman:false`. See [acceptance evidence](docs/ACCEPTANCE.md), [benchmark results](docs/EVALUATION-RESULTS-2026-10-15.md), and [readiness](docs/READINESS.md).

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

Browser tests require a production build and the local 18-source import. Playwright starts its own local server. Tests cover mobile reflow, keyboard access, forced colors, source selection, retry and axe checks. These checks do not certify complete accessibility. You reported successful manual 400% zoom, text-spacing, screen-reader and 12-case semantic reviews; details are limited as described in [acceptance evidence](docs/ACCEPTANCE.md). Automated full-run reliability remains open. See [current readiness](docs/READINESS.md).

## Benchmark evaluation

The 12 gold cases live in `seed/generated/evaluation.json`. Three run modes exist and their totals are never aggregated:

```powershell
# 1. Local CLI suite against Firestore/Vertex (15s case pacing for shared embedding quota)
node --env-file=.env scripts/run-typescript.cjs scripts/evaluate.ts
# Focused retry of one case; writes a separate artifact and never replaces full-run totals
node --env-file=.env scripts/run-typescript.cjs scripts/evaluate.ts -- --case=CASE-HBR
# 2. Deployed-API suite over HTTP with independent /api/sources citation verification
node scripts/run-typescript.cjs scripts/evaluate-deployed.ts --revision=<serving-revision>
# 3. Eight live adversarial semantic regressions
node --env-file=.env scripts/run-typescript.cjs scripts/check-semantics.ts
```

An automated pass requires the expected status (`supported`, or `insufficient_evidence` for empty-evidence cases), every required source ID cited, every excerpt literally present in its verified source, and fact coverage (exact target/QA dates and security status appear in answer text). Reports record per-case outcomes, failures, latency and request counts; the harness does not measure dollar billing. See [evaluation methodology](docs/EVALUATION.md) and recorded results in [readiness](docs/READINESS.md).

## Deploy

```powershell
gcloud auth application-default login
gcloud config set project YOUR_GCP_PROJECT_ID
gcloud services enable firestore.googleapis.com identitytoolkit.googleapis.com run.googleapis.com
gcloud firestore databases create --database="(default)" --location=asia-southeast1 --type=firestore-native
gcloud run deploy knowbridge --source . --region asia-southeast1 --allow-unauthenticated --memory 512Mi --cpu 1 --port 8080 --max-instances 3
```

Set environment variables and mount `GOOGLE_OAUTH_CLIENT_SECRET` / `GOOGLE_PICKER_API_KEY` from Secret Manager as documented in [cloud setup](docs/DEPLOYMENT.md). Cloud Run requires `KNOWBRIDGE_STORE=firestore` and `KNOWBRIDGE_RETRIEVAL=vertex`; file storage is refused. After deployment, confirm the serving revision, `GET /api/health` configuration and one real cited answer from `POST /api/ask` before claiming a working deployment.

## Data and hero facts

The complete reproducible dataset contains 168 fictional documents, 24 sheets, 1,904 rows, 8 projects, 30 invented staff and 12 gold evaluation cases. Apps Script native Workspace seeding is optional; see `apps-script/README.md`.

Harbour customer target: 2026-11-01 (`HBR-DOC-02`). QA forecast: 2026-11-11, recorded 2026-10-10 (`HBR-DOC-04`). Security approval: PENDING (`HBR-DOC-06`). No revised full-release commitment or pilot approval exists (`HBR-DOC-09`, `HBR-DOC-15`). A forecast/readiness mismatch is not proof a customer expectation was never made.

**All organizations, people, emails and records are fictional.** No customer data, legal approval or production certification is claimed.

## Access and cloud setup

Decision briefs require Vertex AI, Firestore and a valid Firebase ID token with `knowbridgeMember:true` (or ingestion admin) plus `knowbridgeTenant:"demo-north-quay"`. The Decision brief panel accepts an operator-provided token in a password field, keeps it only in memory, and sends it as a bearer token. Reload clears it. This is a controlled demo session, not a browser sign-in flow. Create saves automatically; refresh/reopen saved briefs, inspect source text, then deliberately record human review. Review is acknowledgement, never launch approval. Local mode retains public synthetic search but cannot generate briefs. See [brief setup](docs/DEPLOYMENT.md#decision-brief-setup).

Public reads expose only `demo-north-quay` synthetic records. Caller headers cannot select private tenants. `POST /api/ingest` requires a verified, revocation-checked Firebase ID token with `knowbridgeAdmin:true` and `knowbridgeTenant:"demo-north-quay"`. Static ingestion tokens are no longer supported. Body size is capped at 16 KiB; each admin can ingest five times per minute. The shared store enforces the ingestion quota.

Set cloud variables from `.env.example`; use ADC locally and the assigned managed service identity on Cloud Run. Never commit keys or bake them into images. Both `secrets/` and `.secrets/` are excluded from Git and Docker. See `docs/DEPLOYMENT.md` for required API/database/IAM setup.

The container uses `npm ci`, standalone Next output and a non-root runtime. A nonce-based CSP protects production scripts. Dependency overrides are pinned and must be rechecked on upgrades. Mutation endpoints are protected: brief creation requires a revocation-checked Firebase ID token and `Idempotency-Key`, ingestion requires the ingestion-admin claim, and Workspace routes require the connected owner session. Public invocation on Cloud Run is intentional; authorization is enforced in the application and public reads are pinned to the synthetic demo tenant.

## Workflow and tracking

[Audit tracker](https://github.com/alfianhid/knowbridge/issues/21) records findings and verification. Local plan/results: `docs/AUDIT-REMEDIATION-PLAN.md`, `docs/AUDIT-TRACKER.md`.

Use [current readiness](docs/READINESS.md) as the status source; Phase 1/2/3 result files are historical snapshots. Follow the staged prompts only when their entry gates match current readiness. Phase 4 Workspace integration remains optional and should stay on synthetic files until its authorization, lifecycle and residency issues are resolved.

The original planning documents specify team formation on 2026-10-14, internal submission on 2026-10-17 and final submission on 2026-10-18. The user confirmed the registration checkpoint; exact competition-dashboard cutoff remains a dashboard fact.

## Optional Workspace selected-file demo

Latest follow-up: [final deployment and acceptance](docs/WORKSPACE-FOLLOWUP-2026-10-17.md). Revision `knowbridge-00011-xx4` and the matching maintenance image include the reviewed Drive-401 lifecycle fix; 256 tests pass. Registered-file import/search/source checks, changed/trash rejection, separate-member isolation, real revoked-grant cleanup, denial/reconnect and repeated disconnect are recorded with their limits. The account is left disconnected with no credentials/imported copies. #37/#38 are closed; other issue closures/provider-contract decisions are tracked in [readiness](docs/READINESS.md). Original full benchmark artifacts remain unchanged; Phase 5 clearance is not implied. The paragraph below preserves the earlier checkpoint.

Phase 4 is implemented and defaults off in source. The separate Workspace panel binds Google consent to an existing demo member, imports only registered fictional native Docs/first-tab Sheets, and supports scoped search, literal source inspection and disconnect cleanup. Public search and saved briefs keep using the separate seed corpus. Revision `knowbridge-00009-7j5` serves five reviewed audit/live fixes. The fictional-account consent/Picker/three-file import/search/citation/retry/cancel/disconnect path passed; cleanup removed credentials and imported copies. See [live evidence and remaining negative checks](docs/WORKSPACE-LIVE-ACCEPTANCE-2026-10-17.md) and [pre-Phase 5 audit](docs/PRE-PHASE5-AUDIT-2026-10-17.md). Local suite: 249 tests. Complete deployed Ask benchmark: 10/12, median 27.4 seconds including failures/source verification. Earlier full and focused runs remain separate evidence. Approved concise GitHub status comments were posted; all seven Workspace issues remain open. No real Workspace data is permitted.
