# Prioritized backlog — 2 developers; submission no later than Oct 18, 2026

**New P0 (required): `Create and populate dummy near-Enterprise production data`.** This is seeded in the starter and must be integrated into the application. Respect 2026-10-17 as the internal submission date.

| ID | Priority | Task | DRI | Estimate combined | Done when |
|---|---|---|---|---|---|
| KB-001 | P0 | Repo, Next.js, Cloud Run, Cloud project | Dev A | 3–4h | App deploys and /api/health responds |
| KB-002 | **P0** | **Create and populate dummy near-Enterprise production data** | Dev B | 4–6h integration (generator already supplied) | Corpus verified; 168 Docs, 24 Sheets, 12 gold evals; app can import selected documents; synthetic badge visible |
| KB-003 | P0 | Source adapters, chunking, provenance and import status | Dev A | 5–7h | Text/CSV ingestion, deterministic chunk IDs, no duplicates |
| KB-004 | P0 | Gemini embedding + Firestore vector retrieval | Dev B | 5–7h | Top-k results return expected project evidence, tenant-filtered |
| KB-005 | P0 | Grounded Q&A and click-through citations | Dev B | 4–6h | User can inspect literal source evidence; unknown cases abstain |
| KB-006 | P0 | Temporal / conflict analysis | Dev B | 5–7h | Correctly distinguish customer target and QA forecast |
| KB-007 | P0 | Structured AI Decision Brief | Dev B | 5–7h | Schema-validated brief with options, risks, unknowns, evidence |
| KB-008 | P0 | Decision workspace / saved briefs | Dev A | 5–7h | Good UX, save and review, source detail visible |
| KB-009 | P0 | Evaluation, public deployment, README, PDF deck, video | Both | 8–12h | Evidence screenshots, public repo/link, deck/video complete |
| KB-010 | P1 | Google Picker / drive.file OAuth selected-source import | Dev A | 5–8h | Select 5 native Docs/Sheets and ingest, no broad Drive scope |
| KB-011 | P1 | Claim/entity relationships | Dev B | 4–6h | Show 1 project→owner→client→risk chain |
| KB-012 | P2 | Gmail/Chat/Calendar connectors, enterprise SSO, automated workflows | Later | Not now | Only post-hackathon |

Estimates are planning guesses, not verified delivery durations. Some items overlap and can run in parallel.

## Strict scope cuts
- By Oct 14: if retrieval is unreliable, drop Picker and graph; fix index + citations.
- By Oct 15: if agent/workflow is not working, prioritize a single quality Decision Brief with 3–5 cited documents.
- Oct 16: hard feature freeze; from then on security, evaluation, documentation and demo only.

## Schedule
- **Oct 12:** Repo, service configuration, dataset ready; both developers join registered team by Oct 14.
- **Oct 13:** Dev A imports dataset and builds UI shell; Dev B sets up Gemini/Firestore retrieval.
- **Oct 14:** Deployed retrieval with source metadata; verify precise HBR evidence IDs.
- **Oct 15:** Conflicts and Decision Brief end-to-end; basic persistence.
- **Oct 16:** Test matrix and polished flow; optional Picker only if P0 all green.
- **Oct 17:** Record under-three-minute demo; publish code; complete PDF deck and submission.
- **Oct 18:** Contingency only; confirm actual dashboard deadline and timezone.

## Two-dev Git rule
Prefer task-based branches `feat/ingestion`, `feat/decision-engine`, small PRs and one code owner per service boundary. Share contract `src/lib/contracts.ts` and seed facts before parallel implementation. Do not spend a day resolving a framework migration.
