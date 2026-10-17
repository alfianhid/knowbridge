# API status and contracts

## Implemented Phase 1

### GET /api/health
Returns `{service,status:"grounded-search-ready",aiEnabled,retrieval,connectivityVerified:false,syntheticData:true,storage}`. `aiEnabled` means Vertex mode with valid configuration, not verified connectivity or model accuracy. Local mode reports false. Invalid configuration returns 503 with `status:"configuration-required"`.

### GET /api/sources
Returns `{items:[{id,title,kind,project,recordedAt,sourceUrl,chunkCount}],synthetic:true}` from ingested durable storage. Empty storage returns zero items. Fixed public synthetic tenant only. Different tenant header: 403.

### GET /api/sources/:sourceId
Returns literal stored content, title, owner, kind, project, historical recorded/effective dates, source URL and chunk count. Internal tenant/chunk data is omitted. Unknown or unauthorized source: 404; unavailable store: controlled 500.

### POST /api/ingest
Requires `Authorization: Bearer <Firebase ID token>`, verified with revocation checking. Only identities with `knowbridgeAdmin:true` and `knowbridgeTenant:"demo-north-quay"` may mutate.

Body: `{mode:"synthetic",corpus?:"harbour"|"evaluation",sourceIds?:string[]}`. Default corpus: `harbour`. JSON only, maximum 16 KiB, at most 64 distinct known IDs from the selected bounded corpus, maximum 64 characters per ID. No arbitrary paths, private tenant selection or Drive mode.

Response: `{jobId,queued,processed,skipped,failed}`. 200 if all selected sources processed/skipped; 207 for partial store failures. Retry skips unchanged complete records and refreshes metadata changes. Jobs derive deterministically from source records. Invalid requests: 400/415/413. Invalid identity: 401; unauthorized claims: 403; missing auth configuration: 503; quota: 429.

Five ingestion requests per admin per minute, persisted atomically in the selected store. Public reads use a per-instance global limit of 300/minute; this is not a distributed perimeter rate limiter. Deployment must bound Cloud Run instances.

## Storage and provenance

Cloud path: `tenants/demo-north-quay/sources/{sourceId}`. Ingestion atomically replaces each bounded source with embedded chunks. The trusted `index:vectors` CLI materializes separate vector-search chunks; old vector documents can remain but fresh-original hash/chunk checks exclude them. Reindex after updates. Full implemented fields and cache paths are in [architecture](ARCHITECTURE.md).

Chunk IDs use `sourceId:ordinal`, with zero-based `ordinal`, literal `body` and SHA-256 `checksum`. Documents use a 600-word budget; contextualized sheets use 300 words. These are not measured token limits. `autoTruncate:false` makes overlong embedding input fail instead of silently losing evidence. The original cloud import covered 18 sources; later evaluation evidence covers a bounded 55-source profile with 60 indexed chunks, not the full dataset. See [current audit](PRE-PHASE5-AUDIT-2026-10-17.md).

Minimum actual record fields:
```json
{
  "tenantId": "demo-north-quay",
  "id": "HBR-DOC-04",
  "title": "Project Harbour - QA Forecast",
  "kind": "google_doc",
  "recordedAt": "2026-10-10",
  "effectiveAt": null,
  "projectId": "HBR",
  "synthetic": true,
  "contentHash": "sha256:...",
  "sourceUrl": "/api/sources/HBR-DOC-04"
}
```

The historical body date is not a newly created Drive modified timestamp. Checksums, literal chunk body inclusion and inherited chunk provenance are validated before storage and on reads.

## POST /api/ask (Phase 2)

JSON body `{question:string}` only, trimmed length 4–2000 characters, maximum body 16 KiB. Public access is fixed to the isolated synthetic tenant. Extra fields and caller-supplied source permissions are rejected. Tenant mismatch returns 403. The per-instance public read cap also applies.

Returns `{status,answer,claims,unknowns,mode,model,synthetic:true}`. Status is `supported` or `insufficient_evidence`. Claims contain `claim` and `evidence:[{sourceId,excerpt,sourceTitle,sourceUrl,recordedAt,effectiveAt}]`. Answer text is assembled from validated claims. Citation metadata comes from stored originals. Excerpts must match both authorized originals and retrieved chunks literally.

`mode:"local"`, `model:null`: deterministic lexical evidence lookup, explicitly no AI synthesis or decision recommendation. `mode:"vertex"`: query embedding, source-prefiltered Firestore retrieval, fresh-original checks, then structured Gemini synthesis. Source allowlists derive from server-owned public synthetic records, never request fields. Private Workspace ACL replication is not implemented.

Empty retrieval abstains without generation. Invalid schema, citations, decision completeness or semantic assessments retry once, then return controlled 502. Semantic-provider failure returns 503. Abstention uses server-owned text. Originals are checked before synthesis, semantic review and cited return. Missing/stale sources fail closed. Unavailable services/config/indexes return controlled 503; no silent fallback. Quote validation does not prove semantic entailment; live evaluation remains required.

## Decision Brief routes (implemented)

- `POST /api/decision-briefs`: requires verified member identity and `Idempotency-Key` (8–128 ASCII letters/digits/underscore/hyphen). Body is strict JSON `{question:string}` with trimmed length 4–2000; maximum body 16 KiB. Rejects extra fields. Requires Vertex retrieval plus Firestore; no local fallback. Returns 201 and saved brief, or controlled auth/config/retrieval/validation errors.
- `GET /api/decision-briefs`: authenticated owner-scoped list, ordered by `createdAt` descending before limiting to 50. Requires the composite index in `firestore.indexes.json`.
- `GET /api/decision-briefs/:id`: authenticated owner detail; foreign and absent records both return 404.
- `POST /api/decision-briefs/:id/review`: authenticated owner acknowledgement. Server sets reviewer UID/time; retry on an already reviewed brief returns it unchanged. This records human review, not approval or execution.

Stored brief response contains `id`, `question`, `createdAt`, `mode:"vertex"`, `model`, `sourceAttribution:[{sourceId,contentHash}]`, structured `brief`, and `reviewedByHuman`; review adds `reviewerUid` and `reviewedAt`. Response disables caching. No update/delete or client-supplied source, tenant, owner, model or review metadata is accepted.

All brief routes share the existing per-instance 300 requests/minute cap with public reads. This is not a distributed cost control; bound Cloud Run instances and use controlled membership. Citations must match both original sources and retrieved chunks, including conflict evidence. Readiness coverage also checks selected owning records omitted by retrieval; missing security or decision authority fails validation instead of silently disappearing.

### Prepared identity and persistence contract (#25)

`requireBriefIdentity` verifies Firebase ID tokens with revocation checking. Only `knowbridgeTenant:"demo-north-quay"` plus `knowbridgeMember:true` (or ingestion admin) may use brief routes. An ordinary member cannot ingest. UID and tenant come exclusively from verified claims. Public synthetic search does not grant membership. `assertBriefOwner` returns the same 404 for another user's or tenant's record.

Implemented identity and persistence behavior:

- Creation accepts question plus `Idempotency-Key` (8–128 ASCII letters/digits/underscore/hyphen). It rejects client owner, tenant, source permissions, review, timestamp and model-attribution fields.
- `briefIdempotencyId` hashes `[tenantId,uid,key]`. Firestore transaction stores the brief and idempotency record atomically. The same key and canonical request hash return the original result; changed payload returns 409. Generation failures do not persist success.
- List queries constrain both tenant and owner before reading; detail/review use `assertBriefOwner`. Private-source permissions must be rechecked before exposing saved evidence. Current sources remain fictional and publicly readable only in the fixed demo tenant.
- ID, creation timestamp, owner, source hashes and model are server-generated or server-derived. Exact excerpts remain in the validated brief. Source/model attribution is immutable because no edit route exists.
- Review requires a deliberate authenticated owner request after evidence inspection. Server derives UID/time; model/client cannot supply them. Identical review retries return unchanged review. Review records human acknowledgement, never production launch approval or autonomous execution.

Run `node --env-file=.env scripts/run-typescript.cjs scripts/verify-brief-identity.ts` only in a trusted operator environment with `KNOWBRIDGE_ID_TOKEN` and `KNOWBRIDGE_EXPECTED_UID` supplied securely. It prints no token, credentials or email. Mocked tests cover revoked/expired/invalid tokens, missing roles, tenant mismatch, ownership and retry-key scope. Live intended-user evidence is recorded separately in [remediation results](ISSUE-REMEDIATION.md); helper tests alone never establish deployed write readiness.

The current decision contract rejects supported/at-risk briefs without evidence. Server finalization checks exact excerpts and reconstructs source metadata, discarding model URLs/titles/dates and model-supplied review flags. Citation validation alone does not establish that a free-text claim is semantically entailed; that is a Phase 2/3 evaluation gate.

`authorizeChunks` enforces fail-closed tenant/source membership in implemented retrieval. Both query filtering and returned-chunk checks precede Gemini.

## Optional Phase 4 Workspace routes

All routes are server-only, no-store and owner-scoped through the same verified Firebase demo membership. Workspace sources are isolated from public seed search and saved briefs. The flag defaults off. Mutations require exact configured Origin and strict bounded JSON; caller tenant, owner and source permissions are never accepted.

Drive metadata/export HTTP 401 disables the expected connection and removes its imported copies/pending work, then returns a safe 401 reconnect response. Cleanup remains connection-scoped to preserve a newer reconnect. A Vertex embedding 401 does not revoke Google consent. Cleanup failure remains visible with evidence inaccessible and retry possible; no completed deletion is claimed on failure.

- `POST /api/workspace/oauth/start {}` returns a Google consent URL and sets a five-minute HttpOnly binding cookie. The GET callback validates state/code/nonce/Google identity and redirects to a clean app URL. It never returns credentials in the URL.
- `POST /api/workspace/picker {}` returns a current short-lived access token and public Picker configuration for page memory only.
- `GET /api/workspace/status` returns safe connection/source summaries and progress. It remains available when disabled.
- `POST /api/workspace/import {fileIds:string[]}` starts/reuses a bounded job; `POST /api/workspace/import/step {}` advances one export or embedding. Refresh resumes; explicit retry times must be honored.
- `POST /api/workspace/import/cancel {}` discards pending work and prevents late commits; remains available when disabled.
- `POST /api/workspace/ask {question:string}` uses only current authorized imported evidence and the existing citation/semantic gates. Citations point to protected Workspace source routes. No brief saving is supported for imported evidence.
- `GET /api/workspace/sources/:sourceId` revalidates current Drive access/version, then returns evidence text, literal export and separate historical/Drive/import provenance. No public-source fallback.
- `POST /api/workspace/disconnect {}` disables access, discards credentials, attempts grant revocation and clears scoped copies. Remains available when disabled; partial cleanup returns 207 with `cleanup:"incomplete"`, never a false deletion claim.

See [limits, operator prerequisites and remaining live acceptance](WORKSPACE.md). Revision `knowbridge-00009-7j5` includes the reviewed audit fixes and passed the bounded fictional-account consent/Picker/import/search/source/retry/cancel/disconnect path. The complete live negative matrix remains incomplete; see [actual evidence](WORKSPACE-LIVE-ACCEPTANCE-2026-10-17.md) and [current audit](PRE-PHASE5-AUDIT-2026-10-17.md).
