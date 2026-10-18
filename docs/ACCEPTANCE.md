# Acceptance evidence carried forward — 2026-10-15

> Historical checkpoint. Revisions, counts and open tasks describe the recorded date. See [current readiness](READINESS.md) for superseding release, benchmark and submission status.

> Current update — 2026-10-16: the user reports passing human semantic review for all 12 cases and passing manual accessibility checks at 400% browser zoom, with text spacing, keyboard navigation and native screen-reader navigation. Reviewer identity, test date, browser/OS and screen-reader versions were not supplied. Treat these as user-reported passes, not independently reproduced evidence. Automated benchmark failures remain unchanged. See [issue closure](archive/ISSUE-CLOSURE-2026-10-16.md).

This checklist reconciles `audit-tickets.json` with actual evidence. Historical Phase 1 fix/closure records are preserved; they do not prove every future or manual criterion. No waiver is recorded, and predecessor issue state is unchanged. [Current readiness](READINESS.md) separates later-phase deliverables.

| Ticket | Implementation / recorded evidence | Remaining limitations or verification status |
|---|---|---|
| AUD-001 | Durable source store; real import/retry/restart in [Phase 1 results](archive/AUDIT-RESULTS.md) | None claimed beyond bounded synthetic scope |
| AUD-002 | Evidence-required schema and negative tests | Full semantic entailment is #23, not established by schema validity |
| AUD-003 | Authoritative metadata and literal quote checks; integrity tests | No universal semantic accuracy claimed |
| AUD-004 | Fixed public synthetic tenant; source prefilter/post-check tests | Private Workspace ACL replication remains P1; no real-data authorization claimed |
| AUD-005 | Historical targeted upgrades and the 2026-10-15 full-tree audit in [remediation results](archive/ISSUE-REMEDIATION.md) | That audit reported zero vulnerabilities; rerun after dependency changes |
| AUD-006 | Body/ID limits, quotas, selected-ID loading; API/store tests | No distributed perimeter read limiter claimed |
| AUD-007 | Revocation-checked admin ingestion; identity tests | Real demo-member token, tenant membership, ingestion denial and revocation checks passed; member has no ingestion-admin role |
| AUD-008 | Current API/health and local/cloud runbooks | Health checks configuration only |
| AUD-009 | Visible focus/forced colors; historical browser evidence | User reports native screen-reader checks passed; versions/observations not recorded |
| AUD-010 | Separate live status, busy state and retry checks | User reports native screen-reader checks passed; versions/observations not recorded |
| AUD-011 | Wrapping titles and 320px reflow; browser tests | User reports 400% browser toolbar zoom and text-spacing checks passed; environment details not recorded |
| AUD-012 | Focusable labeled source scroll; keyboard test | User reports manual accessibility checks passed; specific keyboard journey and cross-engine details were not supplied |
| AUD-013 | Current-item semantics and interaction tests | User reports native state-announcement checks passed; versions/observations not recorded |
| AUD-014 | Structured sections plus exact original view | User reports native screen-reader navigation passed; versions/observations not recorded |
| AUD-015 | Decorative glyph hidden; semantic tests | No full accessibility certification |
| AUD-016 | Ingestion/provenance/failure/isolation tests; [complete automated runs](archive/EVALUATION-RESULTS-2026-10-15.md): 9/12 and 10/12; all five focused retries passed; user reports human review passed all 12 cases | **OPEN:** repeatable automated full-run reliability. Human-review details are user-reported and lack case-level notes |
| AUD-017 | Historical Chromium/axe/reflow/keyboard/retry checks; user reports manual 400% zoom, text-spacing and screen-reader checks passed | Independent reproduction and browser/assistive-technology details are not recorded; no accessibility certification claimed |
| AUD-018 | Historical Linux CI/container/nonce checks in Phase 1 results | Historical remote CI is not freshly verified deployment evidence |
| AUD-019 | Git/Docker credential-folder exclusions | No key may enter tracked files or build output |
| AUD-020 | Seed verifier passed again: 168 docs, 24 sheets, 1,904 rows, 12 fixtures | Fixture existence is not a 12-case model pass |

## Manual acceptance record

On 2026-10-16, the user reported successful manual checks for 400% browser toolbar zoom, text spacing and native screen-reader navigation. The user also reported successful source-linked semantic review for all 12 cases. The exact test date, reviewer, browser/OS and assistive-technology versions, keyboard-journey details and case-level notes were not supplied. This is a user-reported pass; no independent reproduction or accessibility certification is claimed.

## Full evaluation record

The recorded automated runs remain 9/12 and 10/12; focused retries do not change those totals. Human semantic review is user-reported successful for all 12 cases, but case-level notes and reviewer/environment metadata are absent. Automated semantic regressions, controlled fixture tests, human review and full live benchmark results are separate evidence. See [current readiness](READINESS.md) and [remediation history](archive/ISSUE-REMEDIATION.md).
