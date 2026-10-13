# Audit tracker - 2026-10-13

[GitHub master tracker #21](https://github.com/alfianhid/knowbridge/issues/21). Remediation scope ends before Phase 2.

## Status

All local implementation fixes pass 40 unit/integration tests, lint, typecheck, build, six standalone Chromium browser checks and npm audit (zero vulnerabilities). Full seed verification passed.

Live Firestore verification passed on 2026-10-14: 18 sources imported, fresh-process retry skipped 18, and persisted source/provenance reads passed. Container startup remains pending because Docker is unavailable locally and the user requested no branch publication.

## Findings

- [x] [#1: [HIGH] Persist ingestion and read catalog from the same store](https://github.com/alfianhid/knowbridge/issues/1) - real Firestore import, fresh-process retry and persisted reads verified
- [x] [#2: [HIGH] Reject supported decision briefs without evidence](https://github.com/alfianhid/knowbridge/issues/2)
- [x] [#3: [HIGH] Build citation metadata from authorized server source records](https://github.com/alfianhid/knowbridge/issues/3)
- [x] [#4: [HIGH before real data] Derive tenant and source permissions from verified identity](https://github.com/alfianhid/knowbridge/issues/4)
- [x] [#5: [HIGH] Remediate dependency advisories with targeted upgrades](https://github.com/alfianhid/knowbridge/issues/5)
- [x] [#6: [MEDIUM] Bound ingestion body size and rate-limit API work](https://github.com/alfianhid/knowbridge/issues/6)
- [x] [#7: [MEDIUM] Replace static ingestion bearer token with authenticated admin access](https://github.com/alfianhid/knowbridge/issues/7)
- [x] [#8: [MEDIUM] Update docs and health to reflect actual Phase 1 status](https://github.com/alfianhid/knowbridge/issues/8)
- [x] [#9: [HIGH] Make keyboard focus visible on every source row](https://github.com/alfianhid/knowbridge/issues/9)
- [x] [#10: [MEDIUM] Use concise live status instead of announcing full source bodies](https://github.com/alfianhid/knowbridge/issues/10)
- [x] [#11: [MEDIUM] Allow source titles to wrap at narrow widths and zoom](https://github.com/alfianhid/knowbridge/issues/11)
- [x] [#12: [MEDIUM] Make source-content scrolling keyboard accessible](https://github.com/alfianhid/knowbridge/issues/12)
- [x] [#13: [LOW] Use semantics that match mutually exclusive source selection](https://github.com/alfianhid/knowbridge/issues/13)
- [x] [#14: [LOW] Provide navigable source sections while preserving literal evidence](https://github.com/alfianhid/knowbridge/issues/14)
- [x] [#15: [LOW] Hide decorative brand glyph from assistive technology](https://github.com/alfianhid/knowbridge/issues/15)
- [x] [#16: [MEDIUM] Expand tests for ingestion failures and required evidence gates](https://github.com/alfianhid/knowbridge/issues/16)
- [x] [#17: [MEDIUM] Run browser accessibility and responsive release QA](https://github.com/alfianhid/knowbridge/issues/17)
- [ ] [#18: [LOW/MEDIUM] Harden reproducible container builds and response headers](https://github.com/alfianhid/knowbridge/issues/18) - code and standalone checks complete; Linux container CI pending
- [x] [#19: [MEDIUM] Protect local service-account folders from Git and Docker context](https://github.com/alfianhid/knowbridge/issues/19)
- [x] [#20: [MEDIUM] Install Python and execute full seed integrity verification](https://github.com/alfianhid/knowbridge/issues/20)

## Decisions and evidence

User approved the existing Phase 1 edits, public synthetic read-only UI, authenticated admin ingestion, dependency upgrades and Python installation. Registration checkpoint confirmed. Keys remain local and ignored. Cloud permissions are not inferred from those approvals.

[Verification results](AUDIT-RESULTS.md) document actual commands and limitations. [Implementation plan](AUDIT-REMEDIATION-PLAN.md) records the remediation order. Phase 2 semantic benchmark results are not claimed.

