# Cloud setup and deployment checks

The app is deployed as a controlled synthetic demo at [knowbridge-208529907910.asia-southeast1.run.app](https://knowbridge-208529907910.asia-southeast1.run.app). Current Cloud Run revision and live brief evidence are in [readiness](READINESS.md) and [deployed brief verification](CLOUD-BRIEF-VERIFICATION-2026-10-16.md). Local mode returns deterministic evidence without AI synthesis. Cloud Run requires Vertex AI mode and Firestore. Follow [Phase 2 retrieval setup](RETRIEVAL.md) for model settings, Vertex API/IAM, the vector index and indexing CLI. Health reports configuration readiness, not connectivity.

## Provisioning

Use an owner-authorized account for one-time setup. ADC/service-account runtime access is separate from permission to enable APIs or create databases.

```powershell
gcloud auth application-default login
gcloud config set project YOUR_GCP_PROJECT_ID
gcloud services enable firestore.googleapis.com identitytoolkit.googleapis.com
gcloud firestore databases create --database="(default)" --location=asia-southeast1 --type=firestore-native
```

Check existing database configuration before creation; do not replace an existing database. Configure Firebase Authentication and provision only the intended administrator with custom claims `knowbridgeAdmin:true` and `knowbridgeTenant:"demo-north-quay"` using trusted Admin SDK tooling. Never accept client-set claims. ID-token verification checks revocation.

The runtime identity needs Firestore data access and Firebase Authentication read access for revoked-token verification. Use least-privilege IAM for the selected project. Do not give runtime service identities API-enablement/owner privileges just to make provisioning succeed.

## Decision brief setup

Brief routes require the same Vertex/Firestore configuration as cloud search and a revocation-checked Firebase member ID token. Provision membership only through trusted Admin SDK tooling with `knowbridgeMember:true` and `knowbridgeTenant:"demo-north-quay"`; do not grant ingestion admin solely for briefs. Supply the short-lived ID token through the UI's password field. It stays in browser memory and is cleared on reload. Never paste it into source files, command history, logs or screenshots. Browser sign-in remains future work.

Saved lists use owner filtering plus creation-time ordering before the 50-record limit. Deploy the composite index defined in `firestore.indexes.json` before live listing:

```powershell
gcloud firestore indexes composite create --collection-group=briefs --query-scope=collection --field-config=field-path=ownerUid,order=ascending --field-config=field-path=createdAt,order=descending
```

Check existing indexes first and wait until ready. The index file describes only this new brief index; retain existing vector indexes. No index provisioning is claimed by local tests. Verify create, retry with the same idempotency key, refresh, reopen, literal source inspection, owner isolation and review using the intended member. A review acknowledgement cannot authorize a release.

Command syntax: [official composite-index CLI reference](https://docs.cloud.google.com/sdk/gcloud/reference/firestore/indexes/composite/create).

## Verify durable cloud storage

In a local PowerShell session:
```powershell
$env:GOOGLE_CLOUD_PROJECT="YOUR_GCP_PROJECT_ID"
$env:KNOWBRIDGE_STORE="firestore"
$env:KNOWBRIDGE_RETRIEVAL="vertex"
# Optional local key alternative to owner ADC:
# $env:GOOGLE_APPLICATION_CREDENTIALS=(Resolve-Path .secrets/gcp-sa.json).Path
node --env-file=.env scripts/run-typescript.cjs scripts/ingest-local.ts
node --env-file=.env scripts/run-typescript.cjs scripts/ingest-local.ts
```

First import should process 18 records; retry should skip 18 unchanged records. Restart the app and confirm catalog/detail still read the stored sources. A permission/API failure must be reported, never silently replaced with local or mock cloud success.

Use a fresh shell for cloud commands; explicit shell variables override `.env`. Default import is the 18-source Harbour batch; `--corpus=evaluation` selects 55 sources for all fixture coverage. Reindex expanded/changed sources before claiming live evaluation readiness. The deployed profile uses `global` generation, `us-central1` embeddings, `asia-southeast1` Firestore and `asia-southeast1` Cloud Run. Singapore-only model processing is not claimed. See [retrieval profile](RETRIEVAL.md) and the [current deployment record](CLOUD-BRIEF-VERIFICATION-2026-10-16.md).

On 2026-10-15, the user authorized creating an available Firebase demo identity. Authentication was initialized in the existing project; `knowbridge-demo-reviewer` was created with `knowbridgeMember:true`, the fixed synthetic tenant claim and no ingestion-admin role. A real custom-token/ID-token exchange verified membership, denied ingestion and rejected the token after revocation. This is an operator authentication proof, not browser sign-in. The later [deployed brief verification](CLOUD-BRIEF-VERIFICATION-2026-10-16.md) exercised authenticated create/list/detail and persistence. It did not call the review endpoint; the saved test brief remains unreviewed. [Remediation results](ISSUE-REMEDIATION.md) record the identity proof. No token material belongs in tracked files or logs.

## Container/deployment

`Dockerfile` uses lockfile-enforced installation, standalone build output and non-root `node`. Seed files are traced into standalone output. Runtime excludes local credential/data folders. File mode is refused on Cloud Run; use `KNOWBRIDGE_STORE=firestore` and `GOOGLE_CLOUD_PROJECT`.

For redeployment, retain the dedicated runtime identity, fixed synthetic-only public reads, authenticated mutation routes and conservative instance limit documented in the [deployment report](CLOUD-DEPLOYMENT-2026-10-16.md). Billing alerts are not hard spending stops. Workspace imports use a separate owner-scoped namespace with repeated Drive authorization checks. Only registered fictional files are permitted; the bounded live flow passed on revision knowbridge-00009-7j5. Complete live negative acceptance remains open; see docs/WORKSPACE-LIVE-ACCEPTANCE-2026-10-17.md.

## Verification gates

- Full seed verifier, lint, typecheck, unit/integration tests, build and dependency audit pass.
- Standalone root/catalog/detail work; security headers and nonce CSP are present.
- Browser source selection, retry, keyboard focus/scroll and small-screen reflow pass.
- Missing/unauthorized sources disclose no private data.
- Keys are excluded from Git history, Docker context and output.
- Firestore retry/restart and real member-token verification have recorded evidence; see [Phase 1](AUDIT-RESULTS.md) and [deployed brief verification](CLOUD-BRIEF-VERIFICATION-2026-10-16.md).
- A live Cloud Run URL exists, but deployment smoke checks do not prove full benchmark reliability or production readiness.

Official documentation: [Admin setup](https://firebase.google.com/docs/admin/setup), [ID-token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [Next CSP](https://nextjs.org/docs/app/guides/content-security-policy).
