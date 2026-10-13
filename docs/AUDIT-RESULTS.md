# Phase 1 audit remediation results

Reviewed and verified 2026-10-13. Scope: audit tickets #1–#20; Phase 2 has not started.

## Implemented

- One durable ingestion/read store: crash-safe local files or Firestore transactions. Partial imports, restart, concurrency, unchanged retries, metadata refresh and actual failure counts are covered.
- Fixed synthetic public tenant; verified Firebase admin/tenant claims with revocation checking for HTTP ingestion. Authorized-chunk membership guard is ready for future retrieval.
- JSON body/ID limits, shared five-per-minute admin quotas and bounded public reads.
- Evidence-required brief schema, exact quote matching and server-authoritative citation metadata. Model review flags are discarded.
- Dependency upgrades and pinned patched PostCSS override; reproducible install and non-root Docker runtime.
- Nonce CSP, response security headers, hook lint, source loading/error/retry handling and runtime response validation.
- Visible focus, wrapping titles, concise live status, labeled keyboard scroll regions, current-source semantics, source section headings and exact original text.
- Credential/data exclusions, precise Phase 1 API/setup docs and CI/browser checks.

## Local verification

| Check | Result |
|---|---|
| Python 3.11.9 full seed verifier | PASS: 168 documents, 24 sheets, 1,904 rows, 12 cases |
| Vitest | 40/40 passed in 10 files |
| TypeScript | Passed |
| React hook lint | Passed |
| Next production build | Passed |
| Standalone Chromium browser checks | 6/6 passed, process exit 0 |
| axe WCAG-tagged checks | No violations on tested catalog at 320, 375, 768 and 1440px |
| Keyboard/forced-colors/detail retry | Passed |
| npm audit | Zero vulnerabilities across full installed tree |
| Git diff whitespace check | Passed |
| Secret exclusions | Both local credential folders ignored; no tracked credential files |

Browser results are automated evidence, not a complete WCAG certification or a native screen-reader assessment. 320px reflow checks cover small-screen layout; actual browser toolbar zoom and other browser engines were not tested. No visual regression baseline existed.

The browser suite runs against the production standalone server, with Docker-equivalent static/public assets. Docker is unavailable locally; CI adds an actual build/start/non-root/seed-file smoke check.

## Cloud verification - 2026-10-14

The user provisioned `(default)` in `asia-southeast1`, type `FIRESTORE_NATIVE`. The supplied service account can read the synthetic source collection. Owner ADC is now present and successfully completed ingestion using the application's actual Firestore store.

First process: queued 18, processed 18, skipped 0, failed 0. Fresh-process retry: queued 18, processed 0, skipped 18, failed 0. Both returned job ID `06fcc4fc2b418990`. A further fresh process read 18 persisted sources (16 documents, 2 sheets), confirmed `HBR-DOC-04` forecast `2026-11-11` and recorded date `2026-10-10`, and returned zero sources for an unrelated tenant. The real persistence gate in #1 is complete.

Linux container startup verification under #18 remains pending; changes stay local as requested. Production Firebase administrator provisioning and real revoked-token verification remain deployment checks. No live AI or public deployment is claimed.

Independent backend review identified quota atomicity, evidence hash/body consistency and metadata-only freshness gaps; all three were fixed and regression-tested. Independent React review found no further component defect and requested hook lint enforcement, now installed and passing.

Semantic performance across the 12 AI benchmark cases remains a Phase 2/3 gate, since retrieval and Gemini synthesis are not implemented.
