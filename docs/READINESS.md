# Current readiness - 2026-10-18

All demo organizations, people and records are fictional. This document separates current implementation from dated verification. Cloud state below is the latest repository-recorded state; this documentation audit did not redeploy or recheck cloud resources.

| Gate | Latest recorded status | Evidence and limits |
|---|---|---|
| Seed | Verified again on 18 October | 168 documents, 24 sheets, 1,904 rows, eight projects, 30 invented staff, 12 gold cases. |
| Sources and retrieval | Implemented | Local deterministic lookup; cloud Firestore/Vertex profile contains 55 sources and 60 vector chunks. Full 192-source indexing is not claimed. |
| Grounded Ask | Implemented; focused deployed pass | Literal source validation, temporal/approval distinctions and semantic gate. The 18 October Harbour smoke check passed; this is not a full benchmark. |
| Full model benchmark | Reliability open | Latest recorded complete deployed runs each passed 2/12 with ten HTTP 503 failures. Historical runs and focused retries remain separate. See [Phase 5 results](PHASE5-RESULTS.md). |
| Decision briefs | Implemented; narrow live evidence | Authenticated generation, idempotent save, owner-scoped list/detail and deliberate review acknowledgement. Prior Harbour create/list/detail passed; latest UI pass did not create or review a brief. |
| Judge sign-in | Verified on 18 October | Three fictional accounts, token renewal, reload persistence, sign-out and ingestion denial. Access cutoff: 7 November 2026 at 00:00 WIB. Credentials remain private. |
| Workspace | Implemented for registered fictional files only | Consent, three-file import, source inspection, reuse, cancellation, changed/trash rejection, separate-member isolation, revoked-grant cleanup, denial/reconnect and repeated disconnect recorded. See [follow-up](archive/WORKSPACE-FOLLOWUP-2026-10-17.md). |
| Workspace issue acceptance | Recorded closed under bounded criteria | #32-#38 closure recorded. #34/#35 used revised fictional-demo criteria accepting Picker token-URL and undisclosed provider-region limits. These are not passes of the original criteria. Real-data import remains prohibited. |
| Latest recorded deployment | `knowbridge-00021-tft`, 100% traffic (confirmed live 18 October) | Cloud Run `asia-southeast1`, maximum one instance, concurrency four, 1 CPU, 512 MiB. `00021-tft` shipped the inspect-gate fixes; the preceding `00019-cc8` record is in [UI release evidence](evidence/UI-POLISH-2026-10-18.md). Generation uses `global`; embeddings use `us-central1`. |
| Local automated checks | 279 tests across 38 files verified on 18 October | The earlier 273/37 run is recorded in [UI release evidence](evidence/UI-POLISH-2026-10-18.md); later gates added demo-flow and seed-regen tests. Nine browser cases last passed in the [project cleanup](PROJECT-STRUCTURE.md#cleanup-verification-2026-10-18); browser sign-in and UI checks are separate bounded passes. |
| Human semantics and accessibility | User-reported passes | Twelve cases and manual zoom/text-spacing/screen-reader checks reported; reviewer and environment metadata remain incomplete. No certification claimed. [Acceptance](ACCEPTANCE.md). |
| Security | Implemented controls with residual risks | Owner/tenant checks, private mutations, CSP, credential rotation, shared model request budgets and separate Workspace quotas. Request budgets are not dollar caps. [Security](SECURITY.md). |
| Submission materials | PDF and script exist; video production preview complete with captures staged, final MP4 and submission pending | Remotion preview (local video project): 2:00.4 compact cut, generated narration and 55 aligned cues; nine genuine captures staged at 1920×1080 on 18 October, all awaiting human review. Export blocked on capture approval, narration/caption review and final review. No submission confirmation or exact dashboard cutoff/timezone is recorded. [Checklist](SUBMISSION.md). |

## Next work

1. Rehearse intended judge sign-in and protected create/save/reopen flow before recording.
2. Review the nine staged video captures, narration and subtitles, approve them, then render and publish the under-three-minute video; add its public URL to the submission checklist.
3. Confirm the competition dashboard cutoff/timezone, upload the PDF, and record submission confirmation.
4. Investigate full-run provider reliability. Preserve failures and retries as separate evidence; do not claim a clean 12/12 pass.

Dated reports in [archive](archive/README.md), [Phase 5 results](PHASE5-RESULTS.md) and [evidence](evidence/README.md) retain historical outcomes. Their deployment revisions, issue states and next steps describe their recorded checkpoints, not current instructions.
