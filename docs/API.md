# Proposed API contracts

**These are requirements for Codex, not implemented routes** (except `/api/health`). Protect all mutating routes and source-aware retrieval with validated Firebase ID tokens or an isolated synthetic-only demo mode with strict read-only limitations.

### `GET /api/health`
Already implemented. `{service, status, aiEnabled, syntheticData}`. Change AI state only when real Gemini path is confirmed.

### `GET /api/sources`
Return `{items:[{id,title,kind,project,recordedAt,sourceUrl,chunkCount}],synthetic:true}` limited to authorized data.

### `POST /api/ingest`
Body `{mode:'synthetic', sourceIds?:string[]}`. Response `{jobId,queued,processed,skipped,failed}`. Must not accept arbitrary file paths; use known manifest IDs. `mode:'drive'` P1 with OAuth.

### `POST /api/ask`
Body `{question:string,tenantId?:string}`. Response `{answer:string,claims:[{claim,evidence:[{sourceId,excerpt,sourceTitle,sourceUrl?}]}],unknowns:string[],status:'grounded'|'insufficient_evidence'}`. Return only cited factual assertions; avoid model-provided arbitrary URLs.

### `POST /api/decision-briefs`
Body `{question:string,tenantId?:string}`. Response `DecisionBriefSchema` from `src/lib/contracts.ts` plus server-generated brief ID and timestamps. Strictly check every `sourceId` and literal excerpt against retrieved authorized texts. For briefs with unsupported factual claims, regenerate once or abstain.

### `GET /api/decision-briefs` and `GET /api/decision-briefs/:id`
Return saved briefs visible to requester only. Include `reviewedByHuman` and source IDs.

### `POST /api/decision-briefs/:id/review`
Body `{reviewed:boolean}`. Auth required; records user/timestamp. A `reviewed` flag is not an approval to change project schedules or trigger autonomous execution.

## Firestore entity metadata minimum
```
{
  "tenantId": "demo-north-quay",
  "sourceId": "HBR-DOC-04",
  "title": "Project Harbour — QA Forecast",
  "kind": "google_doc",
  "modifiedAt": "2026-10-11",
  "recordedAt": "2026-10-11",
  "projectId": "HBR",
  "access": "demo-public-synthetic",
  "contentHash": "sha256:...",
  "text": "..."
}
```
Use time-aware metadata from the source content; don't silently reinterpret newly uploaded Drive creation timestamps as historical evidence.
