# API status and contracts

## Implemented Phase 1

### GET /api/health
Returns `{service,status:"source-catalog-ready",aiEnabled:false,syntheticData:true,storage}`. Status describes implemented functionality, not a database connectivity check.

### GET /api/sources
Returns `{items:[{id,title,kind,project,recordedAt,sourceUrl,chunkCount}],synthetic:true}` from ingested durable storage. Empty storage returns zero items. Fixed public synthetic tenant only. Different tenant header: 403.

### GET /api/sources/:sourceId
Returns literal stored content, title, owner, kind, project, historical recorded/effective dates, source URL and chunk count. Internal tenant/chunk data is omitted. Unknown or unauthorized source: 404; unavailable store: controlled 500.

### POST /api/ingest
Requires `Authorization: Bearer <Firebase ID token>`, verified with revocation checking. Only identities with `knowbridgeAdmin:true` and `knowbridgeTenant:"demo-north-quay"` may mutate.

Body: `{mode:"synthetic",sourceIds?:string[]}`. JSON only, maximum 16 KiB, at most 18 distinct known Harbour IDs, maximum 64 characters per ID. No arbitrary paths, private tenant selection or Drive mode.

Response: `{jobId,queued,processed,skipped,failed}`. 200 if all selected sources processed/skipped; 207 for partial store failures. Retry skips unchanged complete records and refreshes metadata changes. Jobs derive deterministically from source records. Invalid requests: 400/415/413. Invalid identity: 401; unauthorized claims: 403; missing auth configuration: 503; quota: 429.

Five ingestion requests per admin per minute, persisted atomically in the selected store. Public reads use a per-instance global limit of 300/minute; this is not a distributed perimeter rate limiter. Deployment must bound Cloud Run instances.

## Storage and provenance

Cloud path: `tenants/demo-north-quay/sources/{sourceId}`. Phase 1 atomically stores each bounded source with its chunks; replacing the record removes stale chunks. Phase 2 will materialize vector-search chunks separately.

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

## Proposed Phase 2/3 routes (not implemented)

- `POST /api/ask`: retrieved authorized evidence only; grounded answer/claims/unknowns or insufficient_evidence.
- `POST /api/decision-briefs`: source-validated structured brief, server timestamps and ID.
- `GET /api/decision-briefs` and `GET /api/decision-briefs/:id`: requester-visible saved briefs.
- `POST /api/decision-briefs/:id/review`: authenticated human review; never schedule approval or autonomous execution.

The current decision contract rejects supported/at-risk briefs without evidence. Server finalization checks exact excerpts and reconstructs source metadata, discarding model URLs/titles/dates and model-supplied review flags. Citation validation alone does not establish that a free-text claim is semantically entailed; that is a Phase 2/3 evaluation gate.

`authorizeChunks` provides a fail-closed tenant/source membership guard for future retrieval. Both query filtering and returned-chunk checks must precede Gemini.
