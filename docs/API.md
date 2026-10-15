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

Chunk IDs use `sourceId:ordinal`, with zero-based `ordinal`, literal `body` and SHA-256 `checksum`. Documents use a 600-word budget; contextualized sheets use 300 words. These are not measured token limits. `autoTruncate:false` makes overlong embedding input fail instead of silently losing evidence. Successful historical cloud indexing covers 18 sources, not the full dataset.

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

## Proposed Phase 3 routes (not implemented)

- `POST /api/decision-briefs`: source-validated structured brief, server timestamps and ID.
- `GET /api/decision-briefs` and `GET /api/decision-briefs/:id`: requester-visible saved briefs.
- `POST /api/decision-briefs/:id/review`: authenticated human review; never schedule approval or autonomous execution.

### Prepared identity and persistence contract (#25)

`requireBriefIdentity` verifies Firebase ID tokens with revocation checking. Only `knowbridgeTenant:"demo-north-quay"` plus `knowbridgeMember:true` (or ingestion admin) may use future brief routes. An ordinary member cannot ingest. UID and tenant come exclusively from verified claims. Public synthetic search does not grant membership. `assertBriefOwner` returns the same 404 for another user's or tenant's record.

Phase 3 must enforce the following before exposing routes:

- Creation accepts question plus `Idempotency-Key` (8–128 ASCII letters/digits/underscore/hyphen). It rejects client owner, tenant, source permissions, review, timestamp and model-attribution fields.
- `briefIdempotencyId` hashes `[tenantId,uid,key]`. Within a transaction, the same key and canonical request hash return the original result; changed payload returns 409. A failed attempt must not be recorded as successful. The helper does not itself implement persistence or atomicity.
- List queries constrain both tenant and owner before reading; detail/review use `assertBriefOwner`. Private-source permissions must be rechecked before exposing saved evidence. Current sources remain fictional and publicly readable only in the fixed demo tenant.
- Created/updated timestamps are server-generated. Persist validated source IDs, hashes, exact excerpts, generation model/settings and question with the brief. Source/model attribution is immutable; changed evidence requires a new brief/version.
- Review requires a deliberate authenticated owner request after evidence inspection. `createReview` derives UID/time on the server; the model/client cannot supply them. Record the reviewed brief version/hash and return unchanged review on identical retries. Review records human acknowledgement, never production launch approval or autonomous execution.

Run `node --env-file=.env scripts/run-typescript.cjs scripts/verify-brief-identity.ts` only in a trusted operator environment with `KNOWBRIDGE_ID_TOKEN` and `KNOWBRIDGE_EXPECTED_UID` supplied securely. It prints no token, credentials or email. Mocked tests cover revoked/expired/invalid tokens, missing roles, tenant mismatch, ownership and retry-key scope. Live intended-user evidence is recorded separately in [remediation results](ISSUE-REMEDIATION.md); helper tests alone never establish deployed write readiness.

The current decision contract rejects supported/at-risk briefs without evidence. Server finalization checks exact excerpts and reconstructs source metadata, discarding model URLs/titles/dates and model-supplied review flags. Citation validation alone does not establish that a free-text claim is semantically entailed; that is a Phase 2/3 evaluation gate.

`authorizeChunks` enforces fail-closed tenant/source membership in implemented retrieval. Both query filtering and returned-chunk checks precede Gemini.
