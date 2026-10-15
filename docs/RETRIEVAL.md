# Phase 2 retrieval

Local retrieval returns deterministic literal evidence, not simulated Gemini answers. Live Vertex AI/Firestore verification completed on 2026-10-15 for the bounded 18-source Harbour batch: 23 vector chunks, a READY index, validated hero citations and absent-information abstention. See [cloud verification results](CLOUD-PHASE2-RESULTS.md). Full 12-case semantic benchmark results are not claimed.

## Local mode

Select both modes explicitly, even when a cloud `.env` already exists. Run these commands in the same PowerShell session:

```powershell
$env:KNOWBRIDGE_STORE="file"
$env:KNOWBRIDGE_RETRIEVAL="local"
npm.cmd run ingest:local
npm.cmd run ingest:local
npm.cmd run dev
```

The first import processes missing sources; retry skips unchanged sources. Shell variables override `.env` for both CLI and Next.js. The CLI does not load `.env` automatically; its `ingest:local` name does not force file storage. Ask through the page or `POST /api/ask` with JSON `{"question":"Can Project Harbour launch on 1 Nov?"}`. Lexical retrieval returns operative paragraphs with source dates and exact excerpts. It has limited lexical recall and does not infer business decisions. Browser tests explicitly select file/local; unit tests use the same safe defaults.

## Cloud settings

Cloud Run refuses local retrieval and file storage. Use ADC locally and a managed service identity on Cloud Run:

```powershell
$env:GOOGLE_CLOUD_PROJECT="YOUR_GCP_PROJECT_ID"
$env:GOOGLE_GENAI_USE_VERTEXAI="true"
$env:GOOGLE_CLOUD_LOCATION="global"
$env:GEMINI_MODEL="gemini-3.8-flash"
$env:EMBEDDING_LOCATION="us-central1"
$env:EMBEDDING_MODEL="gemini-embedding-001"
$env:EMBEDDING_DIMENSIONS="768"
$env:FIRESTORE_DATABASE_ID="(default)"
$env:KNOWBRIDGE_STORE="firestore"
$env:KNOWBRIDGE_RETRIEVAL="vertex"
```

The runnable profile above matches the recorded 2026-10-15 smoke checks. Singapore remains the user's deployment/storage preference. Official [Gemini 3.8 Flash documentation](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-8-flash), checked again on 2026-10-15, lists `global`, `us`, and `eu` endpoints, not `asia-southeast1`. Singapore generation requires new supported-region and project-access verification. Unsupported provider requests fail explicitly; there is no automatic model/location fallback. These settings do not move existing resources or provide Singapore-only model processing.

| Setting | Purpose | Recorded profile |
|---|---|---|
| `GOOGLE_CLOUD_LOCATION` | Generation serving | `global` |
| `EMBEDDING_LOCATION` | Embedding serving | `us-central1` |
| Firestore database location | Persisted sources/vectors | `asia-southeast1` (existing database) |
| Cloud Run region | Application hosting | Singapore intent; deployment unverified |

The [3.8 Flash migration guide](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-8-flash) excludes explicit temperature settings; the app omits that parameter for this model. Model access still needs verification in the selected project.

Copy `.env.example` to `.env`, replace `GOOGLE_CLOUD_PROJECT`, and use ADC (`gcloud auth application-default login`) locally. Next.js loads `.env` automatically. The standalone ingestion/indexing CLI does not load dotenv files; export these settings into the shell before running it, as shown above. Alternatively, Node 22 can load the file explicitly:

```powershell
node --env-file=.env scripts/run-typescript.cjs scripts/ingest-local.ts
node --env-file=.env scripts/run-typescript.cjs scripts/index-vectors.ts
```

The [embedding guide](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings) documents `gemini-embedding-001` and output dimensionality. Embeddings use a separate `us-central1` endpoint, 768 dimensions, document/query task types, no automatic truncation, and normalized finite nonzero vectors. The [Gen AI SDK](https://googleapis.github.io/js-genai/index.html) uses Vertex AI with ADC; no API key is required.

## Exact one-time index setup

### Evaluation corpus extension (#24)

Default ingestion remains 18 Harbour sources. The explicit `evaluation` profile adds every `required_source_ids` in `seed/generated/evaluation.json` plus superseded `POL-DOC-01-V1`, retaining the full Harbour demo. Current selection is 55 sources (42 unique fixture IDs plus the old policy and additional Harbour records), bounded to 64. It preserves both policy effective dates and all eight projects' required evidence.

```powershell
# Local, in the same file/local shell used by the app:
npm.cmd run ingest:local -- --corpus=evaluation
# Cloud operator, in a separate shell without file/local overrides:
node --env-file=.env scripts/run-typescript.cjs scripts/ingest-local.ts --corpus=evaluation
node --env-file=.env scripts/run-typescript.cjs scripts/index-vectors.ts
```

Authenticated HTTP import supports `{mode:"synthetic",corpus:"evaluation"}` and up to 64 unique selected IDs from that profile. Unknown IDs, arbitrary paths and tenant selectors are rejected. Indexing consumes all ingested records through the same tenant-scoped store. Local coverage/import/retry and retrieval tests are not expanded live indexing or semantic benchmark results. Local current-policy lookup excludes superseded/future revisions; explicit historical/comparison queries retain them. Gemini must still interpret effective dates and supersession in retrieved cloud evidence.

Follow [deployment prerequisites](DEPLOYMENT.md). An authorized operator must enable `aiplatform.googleapis.com`. Runtime needs Vertex AI inference access (typically `roles/aiplatform.user`) and Firestore data access. Index creation needs separate index administration permission. No cloud provisioning runs from the app.

Actual schema: `tenants/demo-north-quay/chunks/{chunkId}` contains `sourceId`, chunk provenance, `contentHash`, `embeddingModel`, `embeddingDimensions:768`, and `embedding` as a Firestore `VectorValue`. Queries target the tenant collection and apply `sourceId in authorizedIds` before vector search, batching at most 30 IDs. The matching composite index is `sourceId ASCENDING` plus `embedding` flat vector dimension 768, collection scope. Firestore supports at most 2048 dimensions.

Run this once after setting the actual project/database. PowerShell 7 passes the JSON argument directly; Windows PowerShell 5 users can use `gcloud.cmd --%` with literal project/database values if native JSON quoting is altered.

```powershell
gcloud firestore indexes composite create `
  --project=$env:GOOGLE_CLOUD_PROJECT `
  --database=$env:FIRESTORE_DATABASE_ID `
  --collection-group=chunks `
  --query-scope=COLLECTION `
  --field-config=order=ASCENDING,field-path=sourceId `
  --field-config 'field-path=embedding,vector-config={"dimension":"768","flat":"{}"}'
```

The format and prefilter requirements follow the [Firestore vector guide](https://firebase.google.com/docs/firestore/vector-search). Wait for index readiness before querying; a missing index returns a service error.

The verified Windows PowerShell 5 invocation uses stop-parsing and escaped native JSON arguments (replace the project placeholder):

```powershell
gcloud.cmd --% firestore indexes composite create --project=YOUR_GCP_PROJECT_ID --database=(default) --collection-group=chunks --query-scope=COLLECTION --field-config=order=ASCENDING,field-path=sourceId --field-config=field-path=embedding,vector-config={\"dimension\":\"768\",\"flat\":\"{}\"} --async
```

```powershell
node --env-file=.env scripts/run-typescript.cjs scripts/ingest-local.ts
node --env-file=.env scripts/run-typescript.cjs scripts/index-vectors.ts
node --env-file=.env scripts/run-typescript.cjs scripts/index-vectors.ts
gcloud firestore indexes composite list --project=$env:GOOGLE_CLOUD_PROJECT --database=$env:FIRESTORE_DATABASE_ID
```

The indexing CLI reads durable Firestore originals and runs sequentially over the bounded batch. The observed project quota is five embedding requests per minute; the CLI spaces uncached embedding starts by at least 15 seconds. A restart or concurrent queries can still hit the shared quota: wait a minute and retry. Cached embeddings are not delayed. A tenant-scoped embedding cache uses model, dimensions and chunk checksum. Retries reuse completed embeddings, including after vector write failure. Removed/stale vectors are excluded by fresh-original hash/chunk comparison; reindex after source updates. CLI output reports actual indexed/cache counts, with nonzero exit on error. Indexing is never exposed through a public route.

Contextualized sheets use 300-word chunks because a former 600-word chunk exceeded the embedding endpoint's observed 2048-token input limit. Documents retain the 600-word budget. Original content and literal provenance are preserved; the endpoint rejects overlong input rather than truncating silently.

## Grounding and limits

Source permissions are enforced before retrieval, after vector reads and immediately before generation. Every generation attempt re-reads originals. Citations must match authorized originals and retrieved chunks literally. Server metadata replaces model metadata. Invalid structured output/citations receive one diagnostic retry, then controlled failure. The SDK uses the stable v1 API, a 30-second embedding timeout and a 60-second generation timeout. Gemini 3.8 Flash uses LOW thinking; generation output is capped at 4096 tokens and context at 12 chunks. Empty evidence abstains without generation. Provider-facing JSON Schema omits rejected constraint keywords; full Zod and citation validation remains mandatory afterward. `supported` means evidence-backed findings, including pending or negative states, never approval. Server UTC `asOfDate` anchors relative dates; historical plans do not prove events occurred.

These gates verify provenance, not semantic entailment. Prompts distinguish baseline, forecast, commitment and approved decisions; recorded dates remain distinct from effective dates and Drive timestamps. Live Harbour and unknown-case checks passed; the full gold runs recorded 9/12 and 10/12 automated passes, with all five focused retries passing; see [dated evaluation](EVALUATION-RESULTS-2026-10-15.md). Human semantic quality, clean repeat-run consistency, actual billing costs and deployment require further verification. Public rate limits are per instance and shared with catalog reads; configure conservative Cloud Run instance limits. The five-per-minute embedding quota also limits concurrent Ask requests; this is not a high-throughput deployment.

For readiness/commitment questions, server-owned completeness checks require primary authority citations and exact literal target/QA/security values present in retrieved bodies. The bounded synthetic text parser keeps client expectation, forecast and approval categories separate. It never treats source dates as event completion. Missing facts/citations receive one diagnostic retry; then failure. Signed/revised acceptance questions separately require customer, decision and change-control records when present. These checks complement semantic review; they do not prove entailment.
