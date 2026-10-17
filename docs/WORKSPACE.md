# Phase 4: selected fictional Workspace files

> Latest follow-up: [final dual-image deployment and issue acceptance](WORKSPACE-FOLLOWUP-2026-10-17.md). Revision `knowbridge-00011-xx4`, 256 tests, real grant-loss cleanup and denial/reconnect checks supersede earlier checkpoints below. Final owner state is disconnected with credentials/copies removed; public seed count remains 55. GitHub closure and unresolved provider contracts are tracked individually.

> Current 2026-10-17 audit: [pre-Phase 5 results](PRE-PHASE5-AUDIT-2026-10-17.md) supersede the initial status statements below. Revision `knowbridge-00007-gfj` is deployed; OAuth/registry/KMS/logging preparation and scheduled maintenance exist. Human Google consent and complete live import acceptance are pending. Three further auth/import/maintenance defects are fixed locally and reviewed. Current local suite: 248/248 tests. No issue closure or live Picker pass is claimed.

> Later live follow-up supersedes that checkpoint: revision `knowbridge-00009-7j5` serves five reviewed fixes; 249 tests pass. The registered fictional account completed consent, Picker, three-file import/search/source inspection, vector reuse, cancellation and confirmed repeated disconnect/deletion. [Live evidence and remaining negative scenarios](WORKSPACE-LIVE-ACCEPTANCE-2026-10-17.md) distinguish the bounded pass from full release acceptance. No GitHub issue closure is claimed.

Implementation authorized on 2026-10-17. The user overrode the schedule freeze and incomplete P0 reliability gate. Security, provenance and synthetic-only restrictions still apply. The connector defaults off in source. The bounded live flow is recorded above; broader negative acceptance and dollar billing remain distinct unresolved checks.

## Implemented flow

The separate Workspace panel accepts an existing authorized member Firebase ID token in page memory. Connect opens Google sign-in/consent and binds the verified Google subject to that member. This is not automatic Firebase enrollment; ordinary Google accounts do not gain KnowBridge membership. The operator must provision the existing fictional demo member role separately.

OAuth uses `openid` and `https://www.googleapis.com/auth/drive.file`, online access without refresh tokens, single-use five-minute state, a same-site HttpOnly callback cookie, S256 PKCE and OIDC issuer/audience/nonce/subject verification. Access tokens are retained encrypted with Cloud KMS, bound to the member by authenticated data. Picker receives the access token in browser memory. Application tokens do not enter browser persistence or application URLs, but Google's Picker creates a provider-managed iframe URL containing `oauth_token`. The broader tokens-never-in-any-URL criterion in #34 is therefore not satisfied. Google authorization codes necessarily arrive in the callback query; see the logging prerequisite below.

Picker selects at most three owned native Docs or Sheets. The server accepts only registered file IDs for the connected fictional account, checks current ownership/type/version and compares the actual export with the deterministic evaluation seed before embedding. Docs permit a leading BOM, CRLF/LF transport differences, repeated blank paragraph serialization and a single trailing newline difference for comparison; stored content and chunks retain the literal actual export. Sheets compare the complete first-tab CSV cell matrix, preserving literal CSV separately. Unregistered or edited real content is rejected before a model receives it. Extra tabs are excluded; shared drives, shortcuts, uploaded binaries and files owned by others are unsupported.

An explicit confirmation starts a durable owner-scoped import job. Each request advances one file export or one embedding; there is no background queue. Refresh resumes a job after closing the page. Retry deadlines pause processing; refresh after the displayed time. Completed files become searchable atomically. Failed imports retain any previously completed files and report the failed/unprocessed remainder. Cancellation discards pending data and blocks late commits; already submitted provider calls may incur charges.

Workspace search uses only that member's imported sources. In Vertex mode it ranks their validated vectors in memory, generates structured Gemini claims, validates literal citations and applies the existing semantic gate. It revalidates Drive access/version, connection and original content before model stages and before response. Provider uncertainty fails closed. Local mode is explicitly deterministic evidence lookup; importing/indexing still requires configured Vertex embeddings. No public source/vector query is used for Workspace retrieval.

The current Workspace path does not save imported-evidence decision briefs. Public Ask and saved Decision Brief routes continue using the separate seed corpus. No imported excerpts can be saved through those routes; consequently disconnect has no Workspace-derived saved briefs to redact. Workspace answers remain in page memory and clear on member change, disconnect, token expiry or failed access. Source inspection uses an authenticated private route, with historical dates separate from Drive modified/version/import timestamps.

## Enforced bounds and storage

| Bound | Current implementation |
|---|---|
| Selected/retained files | Three per owner; three distinct file admissions per rolling 24 hours |
| Export size | 64 KiB per file, 192 KiB across retained files |
| Chunks | 32 total retained chunks; document/sheet seed word budgets remain unchanged |
| Durable document | Validated serialized owner state capped at 850 KiB |
| Embedding attempts | 64 per owner and 128 connector-wide per rolling 24 hours, including failures and retries |
| Pacing | At least 31 seconds between connector embedding reservations, stricter than the proposed 13 seconds; query embeddings share this budget |
| Provider deadline | Existing embedding SDK has a 30-second request deadline; failed/ambiguous attempts consume budget |
| Retry | At most two retryable provider failures per step; valid numeric/date Retry-After honored |

The connector ledger does not cover the existing public Ask or trusted indexing CLI. Provider quota may therefore still return 429. It is not a project spending cap or a guarantee against duplicate provider billing after an ambiguous timeout. Failed/paced query embedding requests return a controlled error and do not silently use local retrieval.

Server-only collections: `workspace_connections/{sha256([tenant,uid])}`, `workspace_oauth_attempts/{sha256(state)}`, `workspaceImports/{sha256([tenant,uid])}` and `workspaceQuotas/embeddings`. No client Firestore reads/writes are needed. Originals, literal export, chunks, validated vectors and the bounded pending job share the import document. Vectors are wrapped as objects at persistence because Firestore forbids directly nested arrays. No separate vector index/cache is required. Daily ledgers survive disconnect to prevent quota reset abuse.

Disconnect disables the connection and discards encrypted credentials transactionally before attempting token revocation. Imported originals, pending job and embedded vectors are then cleared. Cleanup is scoped to the disconnected connection, so a concurrent new connection is preserved. A revocation failure is reported as unconfirmed; local deletion does not prove Google grant revocation. A cleanup failure returns HTTP 207 and must be retried. Expiry on access/status follows the same invalidation/cleanup path. Detected revoked/deleted/changed files are removed from current retrieval; all reads fail closed if current access cannot be checked.

## Operator setup before enablement

1. Keep `KNOWBRIDGE_WORKSPACE_ENABLED=false` while configuring. Use a dedicated fictional Google test account and native files created by [the seeder](../apps-script/README.md). No real files or sensitive data.
2. Enable Google Drive API, Google Picker API and Cloud KMS in the selected Google Cloud project. Configure the OAuth consent screen in testing and add the dedicated fictional account as a test user. Provision a web OAuth client with the exact origin and callback `WORKSPACE_ORIGIN/api/workspace/oauth/callback`. Use a separate client for localhost development. No wildcard redirects.
3. Set the server-side variables in [.env.example](../.env.example). Keep the client secret in Secret Manager/secure environment injection. Set the Picker project number as `GOOGLE_PICKER_APP_ID`. Restrict the browser Picker key to the Picker API and the required referrers, including the configured application and `https://docs.google.com/*` as required by [Google's Picker setup](https://developers.google.com/workspace/drive/picker/guides/web-picker).
4. Provision a dedicated symmetric Cloud KMS key and grant only the connector runtime key-scoped encryption/decryption. Existing runtime Firestore and Vertex permissions are also needed. Never grant browser access to these server collections or KMS. Verify actual Firestore location, KMS location, log routing and backup/PITR retention.
5. Record the test account's verified Google OIDC `sub`, not its email, in `WORKSPACE_ALLOWED_SUBJECTS`. Set `WORKSPACE_REGISTRY_JSON` to up to three `{fileId,sourceId,subject}` records. Use IDs from `apps-script/Code.gs` output files and source IDs within the deterministic evaluation profile. No user-supplied registry is accepted by APIs. Never paste access/ID tokens into logs or documentation.
6. Before consent, exclude callback request-query logging at Cloud Run/proxy/logging sinks and verify that authorization codes cannot be retained in request logs, analytics or screenshots. The application redirects immediately to a clean URL, disables caching/referrers and never logs provider errors; these measures cannot remove upstream request logs. Log filtering/exclusion configuration is not provisioned by this change.
7. Schedule trusted maintenance at least hourly and alert on failures. Dry-run: `node --env-file=.env scripts/run-typescript.cjs scripts/cleanup-workspace.ts`. Execute with `--execute` to invalidate expired/inactive connections, clear their import copies and remove expired OAuth attempts. The script prints counts only and paginates through all connections and expired attempts; a 601-record regression covers deletion during pagination. The hourly scheduler and failure-alert policy are provisioned; scheduled and manual executions have completed. This is bounded execution evidence, not a guaranteed retention service level. Backup erasure is separate from application deletion.
8. Set the feature flag true only in a controlled fictional-account environment. Run the live acceptance matrix below; inspect CSP/browser errors with the actual Google Picker. Local tests use doubles and do not establish real Picker compatibility, OAuth consent configuration or KMS/Firestore permissions.

Google's [export API](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export) supports `drive.file`; KnowBridge applies tighter byte limits than the provider. Current deployment evidence records generation in `global`, embeddings in `us-central1` and Run/Firestore in Singapore. This is not Singapore-only processing. Drive, OAuth, logs and backups need the inventory above. UI discloses the non-Singapore model endpoints before consent/import.

## Live acceptance and rollback

Bounded live passes include fictional-account consent, Doc and multi-tab Sheet selection, exact source inspection, unchanged import reuse, cancellation, disconnect/revocation and measured provider-attempt usage/latency. The complete provider lifecycle, changed/deleted/revoked-file, cross-user, forced KMS/cleanup failure and quota-exhaustion matrix is not yet established live. Local controlled tests remain separate evidence. Record deployed revision, timestamp, actual request counts and errors. Do not count local doubles or focused benchmark retries as live acceptance.

Disable the flag to block new OAuth/import/search/Picker work. Authenticated status/disconnect/cancel remain available. Complete cleanup and revoke retained grants before restoring the previously verified Cloud Run revision. Keep the seed namespace intact and smoke-test public search, source views and saved seed briefs. Code rollback alone cannot delete retained copies. No deployment or rollback was performed in this implementation turn.

## Open issue acceptance

#32–#38 now have local implementation covering their core access/lifecycle/import contracts, plus unit/service/API/UI tests. They remain open pending live acceptance, provider configuration, complete region/backup inventory, cleanup scheduling and measured cost/latency. #38's development schedule gate was explicitly overridden by the user; the historical P0 benchmark limitations remain unchanged.

## Local verification — 2026-10-17

- `python scripts/verify_seed.py`: passed; 168 documents, 24 sheets, 1,904 rows, 12 cases.
- `npm.cmd install`: passed. Initial direct OAuth dependency addition hit sandbox network restrictions; the authorized network retry succeeded. `google-auth-library` is a direct dependency pinned to 10.9.1. Install script approval settings were preserved.
- `npm.cmd test`: 240/240 passed across 32 files. Baseline was 188 tests. New coverage includes OAuth/state/KMS failures, file/owner isolation, literal exports, Sheets validation, stale/revoked evidence, retry budgets, Firestore vector serialization, cancellation/cleanup races, API boundaries, Picker loading failures and UI transitions. Provider and persistence tests use controlled doubles.
- `npm.cmd run lint` and `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed, including TypeScript and all Workspace routes. Existing Next ESLint-plugin detection notice remains non-blocking.
- `npm.cmd run test:e2e`: 9/9 passed, including existing seed brief/catalog/Ask journeys, mobile axe/reflow checks and disabled Workspace import rejection. Windows test-server teardown stalled after the tests; stopping that task-created server allowed Playwright to exit successfully. This does not test live Google consent or Picker.
- Local ingestion verification: 18 queued, zero processed, 18 unchanged skipped, zero failed. Existing local seed records were preserved.
- ECC code, React and TypeScript reviewers found no critical/high defects. Their two medium findings—stalled Picker script loading and old cleanup erasing a reconnect—were fixed with bounded loading and connection-scoped cleanup, with regression tests.

Files added: `src/lib/workspace-{auth,config,import,store,query,response,picker}.ts`; `src/components/workspace-panel.tsx`; protected `src/app/api/workspace/` routes; `scripts/cleanup-workspace.ts`; six `tests/workspace-*` suites and `tests/e2e/workspace.spec.ts`; this setup document. Integration edits: page mount, middleware/CSP, middleware tests, deterministic Playwright environment, dependency manifests, `.env.example`, Phase 4 prompt and current README/API/readiness/gate documentation. Earlier uncommitted Phase 3 work was preserved. No commit, deployment, OAuth client provisioning or GitHub issue closure was performed.

Next task: provision the documented fictional-account OAuth/Picker/KMS/registry configuration and maintenance/logging controls, then run and record live acceptance before enabling a deployed connector.

Follow-up: [2026-10-17 cloud configuration and partial live acceptance](WORKSPACE-CONFIGURATION-2026-10-17.md) records configured Picker/KMS/Secret Manager/logging resources and the successful real runtime KMS check. OAuth, registered files, maintenance scheduling and full live acceptance remain blocked on the account/browser handoff. This supersedes “configuration absent” only for those four populated resource settings; it does not establish live connector readiness.
