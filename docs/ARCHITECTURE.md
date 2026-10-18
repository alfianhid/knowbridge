# Architecture and technology ADR

## Decision
Single Next.js/TypeScript app on **Cloud Run**, server APIs with **Firebase Admin** (Firestore + optional Firebase Auth verification), **Google Gen AI SDK** with **Vertex AI/Gemini**. Documents initially loaded from `seed/generated`; optional Google Picker/Drive selected-file import implemented for registered fictional files. Avoid extra vector DB, Kubernetes and separate Python API.

### Pipeline
```
Seed text/CSV  OR Google Picker selected Docs/Sheets
 -> Source adapter (stable sourceId, title, project, effective date, sourceUrl, tenantId, access)
 -> text normalizer + CSV contextualization
 -> deterministic word-budget chunks (600 words/document, 300 words/contextualized sheet)
 -> Gemini embedding-001 outputDimensionality=768
 -> Firestore collection(s) per tenant or tenant ID constrained queries + vector index
 -> top-k retrieval filtered to allowed user/tenant sources before model prompt
 -> Gemini structured evidence answer / Decision Brief
 -> Zod schema validation + literal quote/source-ID verification
 -> Firestore saved brief with owner-scoped review state
```

### Implemented storage

Public reads are fixed to `demo-north-quay` and fictional records. These paths are Admin SDK server storage, not client permissions:

- `tenants/demo-north-quay/sources/{sourceId}`: `id`, `title`, `kind`, `project`, `projectId`, optional `department`, `owner`, `recordedAt`, nullable `effectiveAt`, `sourceUrl`, `chunkCount`, `chunks`, `contentHash`, `content`, `tenantId`, `synthetic:true`. No `indexedAt` or per-reader ACL field is currently stored.
- Embedded source chunks: `id` (`sourceId:ordinal`), `sourceId`, `title`, `recordedAt`, `effectiveAt`, `projectId`, zero-based `ordinal`, `checksum`, literal `body`, `tenantId`.
- `tenants/demo-north-quay/chunks/{chunkId}`: operator-materialized chunk fields plus source `contentHash`, `embeddingModel`, `embeddingDimensions:768`, and `embedding` (`VectorValue`). Stored originals remain authoritative. Missing/model-mismatched/stale vectors are excluded; reindex after source changes.
- `tenants/demo-north-quay/embeddingCache/{model}-768-{checksumHex}`: `values`, `model`, `dimensions`, `checksum`. Retries reuse validated cache records.
- `tenants/demo-north-quay/ingestionQuotas/{principalHash}`: atomic `window` and `count` for ingestion quotas.

The ancestor tenant document need not exist. No tenant profile document is created by ingestion. Local file storage retains the same complete source record with embedded chunks.

### Implemented Decision Brief persistence

Decision Brief APIs require Vertex retrieval and Firestore storage; there is no local or deterministic brief fallback. `tenants/demo-north-quay/briefs/{briefId}` stores the validated question and brief, server-generated ID/creation time, verified owner UID, `mode:"vertex"`, model, source IDs with content hashes, and `reviewedByHuman`. Review adds reviewer UID/time. `tenants/demo-north-quay/briefIdempotency/{keyHash}` stores the canonical request hash and brief ID. A Firestore transaction creates both records atomically. Identical retries return the original brief; a changed question with the same key returns 409.

Creation uses verified Firebase identity and tenant membership. Retrieval source selection is derived from server-owned synthetic records; authorized chunks are rechecked before generation and originals are reread before finalization. Brief listing constrains owner in the Firestore query. Detail and review enforce owner, returning 404 for absent or foreign records. The review route records human acknowledgement only; it cannot approve a launch or trigger an action. Workspace uses a separate owner-scoped import/search path; its sources cannot enter saved seed briefs. General per-reader ACL replication remains unimplemented.

Phase 2 materializes vector chunks with `sourceId`, inherited provenance, `contentHash`, `embeddingModel`, `embeddingDimensions:768`, and `embedding` (`VectorValue`). A collection-scoped composite index covers `sourceId ASCENDING` and the 768-dimensional flat `embedding` field. Tenant-scoped `embeddingCache` records reuse model/dimension/checksum-matched embeddings. Exact setup and current model choices: [retrieval setup](RETRIEVAL.md).

**Security rule:** With Admin SDK and server-side queries, Firestore Security Rules do *not* enforce server access. Verify identity in API, authorize tenant and source membership before retrieval, and re-check returned chunks before Gemini sees them. For first demo, use a *single isolated synthetic tenant with read-only public access and restricted write APIs*, or verified Firebase Auth; never deploy a publicly writable ingestion API.

**Firestore vector note:** Vector index dimension must match stored vectors. Firestore supports max 2048 dimensions; choose 768. For scoped vector queries use composite indexes where necessary. Run vector index creation commands based on current gcloud SDK documentation and actual deployed schema.

**Google model note:** Look up a currently available Gemini Flash model and ensure it works in your chosen Vertex AI location. Do not invent a specific model ID. App should fail explicitly with missing settings. Use a managed Cloud Run service identity with least-privilege Vertex AI/Firestore permissions.

**Google Drive note:** `drive.file` + Google Picker provides per-file access for your app. Drive files.export for Docs -> text/plain; for Google Sheets -> text/csv (first tab). Multi-sheet retrieval is P1/P2 via Sheets API. A seeded historical date in a document is NOT equivalent to its newly created Drive modifiedTime.

## Fault handling
- Unsupported question/no indexed data -> insufficient evidence, no fabricated quote.
- Gemini schema parse failure -> retry once with invalid response diagnostics, then explicit failure.
- Citation validator failure -> remove unsupported claim or abstain; do not display a fabricated footnote.
- API/quotas unavailable -> show controlled error and existing saved decisions, not silent fallback to fake AI.
- Rate-limit ingestion; make source idempotent by content hash; batch operations and avoid duplicate embeddings.

## Cost/scope
Current chunking uses 600-word document and 300-word sheet budgets, not tokenizer guarantees. Literal content is preserved. Embedding requests disable automatic truncation; overlong input fails visibly. The original embedding run covered 18 sources; later measured indexing covered the bounded 55-source evaluation profile and 60 chunks. Neither proves full 192-source coverage or model accuracy. Workspace uses separate owner-scoped stored vectors and durable import attempt budgets. Public Ask remains outside that connector ledger; current limits are not a project spending cap. See [current audit](archive/PRE-PHASE5-AUDIT-2026-10-17.md).

Useful docs:
- https://firebase.google.com/docs/firestore/vector-search
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export
- https://googleapis.github.io/js-genai/index.html
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings

## Current API model budgets

`tenants/demo-north-quay/modelQuotas/{key}` stores atomic UTC-day request counters for public Ask and brief creation (300 shared daily by default; brief creation also 100 per UID). Workspace retains its separate import/query-embedding ledger. See [API budgets](API.md#shared-model-request-budgets). These are request counts, not billing caps.
