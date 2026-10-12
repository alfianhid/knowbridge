# P0: Create and populate dummy near-Enterprise production data

## Requirement
No friends, employers or colleagues need to supply data. Create a believable **synthetic single-company knowledge corpus** with decisions crossing departments and versions. 'Near-enterprise' refers to *structure and complexity*, not measured production readiness or real customers.

## Included population
- Fictional org: North Quay Digital Pte. Ltd. — must always be labeled **fictional**.
- 8 interconnected client projects: Harbour, Meridian, Northstar, Orchard, Beacon, Atlas, Juniper, Cedar.
- 30 invented employees, with reserved `@example.com` emails; linked project owners, vendors, clients.
- 168 synthetic Google-Doc-like records: 16 distinct operational documents per project (128); 8 policies × 2 revisions (16); 24 cross-functional briefings.
- 24 synthetic Google-Sheet-like CSV records: milestones and risk registers for 8 projects (16); 8 corporate workbooks.
- 1,904 spreadsheet data rows spanning staffing, pipeline, procurement, support, incidents, renewals, budgets and skills.
- 12 benchmark cases: 8 project release decisions, 1 detailed date mismatch, 1 current-policy lookup, 1 missing approval, 1 absent personal-data question.
- Four conflict categories to test: superseded baseline, competing status/forecast, pending approval and policy version.

## Reproducibility
`python scripts/generate_seed.py` overwrites the same synthetic outputs deterministically. `python scripts/verify_seed.py` checks uniqueness, file structures, row counts, citation references, synthetic labels and the Harbour hero dates. The seed bundle JSON makes a Google Apps Script upload of *native Docs and Sheets* possible. Files are safe for public demo if synthetic disclosure remains visible.

## Exact project Harbour truth
- Baseline and client expectation: 2026-11-01 (HBR-DOC-01, -02).
- Newer QA completion forecast: 2026-11-11 (HBR-DOC-04).
- Security production approval: PENDING as of 2026-10-11 (HBR-DOC-06).
- No approved revised commitment / pilot: HBR-DOC-09 and HBR-DOC-15.
- Decision recommendation: do not unconditionally commit to original full production date; coordinate update with customer, QA and security owners. The algorithm MUST NOT say 'full launch definitely impossible' solely from these docs.

## Realism rules
- Statements carry dates, owners, levels of authority, statuses, relationship references and scope.
- Explicitly distinguish decisions from proposals: statuses include DRAFT, PENDING, OPEN, APPROVED, NOT APPROVED.
- QA may forecast a date later than the customer promise; that's a **readiness mismatch**, not a strict factual contradiction about the same field.
- Older policies are intentionally superseded by newer versions: retrieve the current revision.
- Synthetic docs are not regulatory policies, legal advice or actual financial records.
- Newly seeded Google Docs/Sheets have today's Drive file timestamps, but **historical source dates in body** are the simulated business timeline.

## Population options
1. **Recommended first:** index local `seed/generated/docs/*.txt` and `seed/generated/sheets/*.csv`. Read `manifest.json` for stable metadata. This is deterministic and does not require OAuth.
2. **Optional live Workspace demo:** upload `seed_bundle.json` into your isolated Google test account and run `apps-script/Code.gs` (see its README). It creates 192 **native Google Docs/Sheets**. This uses your explicit authorization. Use Google Picker to connect selected files afterwards.

## Demo privacy
Never import real employment records. Fake names and fictional companies are intentional. Do not use fake testimonials, claim real-world validation, or call these 'customer records' without the synthetic qualifier.
