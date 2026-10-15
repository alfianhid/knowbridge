# Acceptance evidence carried forward — 2026-10-15

This checklist reconciles `audit-tickets.json` with actual evidence. Historical Phase 1 fix/closure records are preserved; they do not prove every future or manual criterion. No waiver is recorded, and predecessor issue state is unchanged. [Current readiness](READINESS.md) separates later-phase deliverables.

| Ticket | Implementation / recorded evidence | Extended acceptance still open |
|---|---|---|
| AUD-001 | Durable source store; real import/retry/restart in [Phase 1 results](AUDIT-RESULTS.md) | None claimed beyond bounded synthetic scope |
| AUD-002 | Evidence-required schema and negative tests | Full semantic entailment is #23, not established by schema validity |
| AUD-003 | Authoritative metadata and literal quote checks; integrity tests | No universal semantic accuracy claimed |
| AUD-004 | Fixed public synthetic tenant; source prefilter/post-check tests | Private Workspace ACL replication remains P1; no real-data authorization claimed |
| AUD-005 | Historical targeted upgrades/audit in Phase 1 results | Current dependency audit must be measured, not inferred from old zero count |
| AUD-006 | Body/ID limits, quotas, selected-ID loading; API/store tests | No distributed perimeter read limiter claimed |
| AUD-007 | Revocation-checked admin ingestion; identity tests | Real demo-member verification is separate #25; member has no ingestion-admin role |
| AUD-008 | Current API/health and local/cloud runbooks | Health checks configuration only |
| AUD-009 | Visible focus/forced colors; historical browser evidence | Native announcement behavior is not inferred |
| AUD-010 | Separate live status, busy state and retry checks | Native screen-reader announcements remain untested |
| AUD-011 | Wrapping titles and 320px reflow; browser tests | **OPEN:** actual 400% browser toolbar zoom and text-spacing assessment |
| AUD-012 | Focusable labeled source scroll; keyboard test | Cross-engine/manual assistive-technology coverage remains limited |
| AUD-013 | Current-item semantics and interaction tests | Native state announcements remain untested |
| AUD-014 | Structured sections plus exact original view | **OPEN:** native screen-reader heading/region navigation |
| AUD-015 | Decorative glyph hidden; semantic tests | No full accessibility certification |
| AUD-016 | Ingestion/provenance/failure/isolation tests; [complete live runs](EVALUATION-RESULTS-2026-10-15.md): 9/12 and 10/12; all five focused retries passed | **OPEN:** human semantic review and single-run reliability (final repeat had two request failures). Dependencies #24 corpus and #23 gates now implemented/tested |
| AUD-017 | Historical Chromium/axe/reflow/keyboard/retry checks | **OPEN:** actual 400% toolbar zoom and native screen-reader journey; desktop/mobile engine limits remain explicit |
| AUD-018 | Historical Linux CI/container/nonce checks in Phase 1 results | Historical remote CI is not freshly verified deployment evidence |
| AUD-019 | Git/Docker credential-folder exclusions | No key may enter tracked files or build output |
| AUD-020 | Seed verifier passed again: 168 docs, 24 sheets, 1,904 rows, 12 fixtures | Fixture existence is not a 12-case model pass |

## Manual accessibility record

Platform: Windows; recorded automated browser checks use Playwright Chromium. Native computer APIs are disabled in this session. No native screen-reader or real browser-toolbar zoom assessment was performed; no browser/assistive-technology version is invented. CSS zoom, a small viewport and axe cannot substitute for those checks.

Required manual evidence: tester/date, Windows/browser version, zoom set through browser UI to 400%, text spacing (line height 1.5, paragraph spacing 2, letter spacing 0.12em, word spacing 0.16em), complete keyboard source/Ask/retry journey, and named native screen reader/version with heading/region/status observations. Record failures and fixes before closing these criteria. No human waiver or semantic review is assumed.

## Full evaluation record

Use the supported evaluation corpus and the live evaluation script; record model/settings, timestamp, source IDs, latency, citation validity, fixture coverage and automated pass/fail per case. Keep human semantic review explicitly pending until a person reviews actual source-linked outputs. Automated semantic regression results (eight statements) and unit-test counts are separate totals. See [remediation results](ISSUE-REMEDIATION.md) for the current run and remaining gates.
