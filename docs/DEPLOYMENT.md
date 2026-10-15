# Cloud setup and deployment checks

The source catalog and Phase 2 grounded search are implemented. Local mode returns deterministic evidence without AI synthesis. Cloud Run requires Vertex AI mode and Firestore. Follow [Phase 2 retrieval setup](RETRIEVAL.md) for model settings, Vertex API/IAM, the exact vector index command and the explicit indexing CLI. Health reports configuration readiness, not connectivity. Live bounded-corpus verification is recorded in [cloud results](CLOUD-PHASE2-RESULTS.md); it does not establish deployed Cloud Run or administrator authentication readiness.

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

Use a fresh shell for cloud commands; explicit shell variables override `.env`. Default import is the 18-source Harbour batch; `--corpus=evaluation` selects 55 sources for all fixture coverage. Reindex expanded/changed sources before claiming live evaluation readiness. Generation uses `global`, embeddings use `us-central1`, Firestore remains `asia-southeast1` and Cloud Run Singapore hosting remains a deployment intent. See [retrieval profile](RETRIEVAL.md); Singapore-only model processing is not claimed.

On 2026-10-15, the user authorized creating an available Firebase demo identity. Authentication was initialized in the existing project; `knowbridge-demo-reviewer` was created with `knowbridgeMember:true`, the fixed synthetic tenant claim and no ingestion-admin role. A real custom-token/ID-token exchange verified membership, denied ingestion and rejected the token after revocation. This is an operator authentication proof, not a browser sign-in or human review. [Remediation results](ISSUE-REMEDIATION.md) record the timestamp. No runtime IAM role or stored credential was changed. The browser key auto-created by Firebase and all token material remain outside tracked files/logs.

## Container/deployment

`Dockerfile` uses lockfile-enforced installation, standalone build output and non-root `node`. Seed files are traced into standalone output. Runtime excludes local credential/data folders. File mode is refused on Cloud Run; use `KNOWBRIDGE_STORE=firestore` and `GOOGLE_CLOUD_PROJECT`.

When deployment is authorized, enable Cloud Run/Build/Artifact Registry, assign a dedicated service identity, and set a conservative instance limit. Public access is appropriate only for the fixed synthetic UI: reads remain public and ingestion remains identity-protected. Set billing alerts before AI bulk ingestion; alerts are not hard spending stops.

## Verification gates

- Full seed verifier, lint, typecheck, unit/integration tests, build and dependency audit pass.
- Standalone root/catalog/detail work; security headers and nonce CSP are present.
- Browser source selection, retry, keyboard focus/scroll and small-screen reflow pass.
- Missing/unauthorized sources disclose no private data.
- Keys are excluded from Git history, Docker context and output.
- Actual Firestore retry/restart and actual administrator authentication are verified.
- Record a real deployed URL only after deployment; no deployed URL is claimed by local tests.

Official documentation: [Admin setup](https://firebase.google.com/docs/admin/setup), [ID-token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [Next CSP](https://nextjs.org/docs/app/guides/content-security-policy).
