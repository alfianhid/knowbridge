# Codex rules — KnowBridge

## Project intent
Build a real, end-to-end AI Builder Cup demo. Two developers. Singapore-first, English-first, Google Workspace SMEs. Product: grounded search + conflict/temporal evidence + explainable decision briefs. Implement on Google Cloud using Gemini and Cloud Run by the 2026-10-18 deadline.

## First commands before coding
1. Read `README.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DATASET.md`, `docs/BACKLOG.md`, `docs/API.md`, `docs/EVALUATION.md`.
2. Run `python scripts/verify_seed.py` and report the counts.
3. Run `npm install`, `npm test`, `npm run build` if permitted by environment. If network/dependencies absent, disclose precisely; do not claim successful execution.
4. Inspect existing code before edits and avoid broad unrelated refactors.

## Priority order
P0: deterministic synthetic dataset (already generated), ingestion, grounding with citations, conflict/timeline analysis, decision briefs, save/review, security basics, Cloud Run. P1: Picker selected-file import, lightweight entity linking. P2: autonomous actions, Gmail/Chat/Calendar, knowledge graph UI, organization-wide sync.

## Non-negotiable quality gates
- NO fabricated citations, quotations, source IDs, file links, or unsupported approval claims. Every quoted excerpt must match source text and be accessible to the requesting user.
- Distinguish **baseline vs forecast vs commitment vs approved decision** and **document effective date vs Drive updated timestamp**.
- When evidence is absent, clearly say **insufficient evidence**; do not infer approval or completion.
- Never call a generated recommendation an autonomous decision; a human must verify high-impact recommendations.
- Restrict retrieval **before** Gemini: query and post-check only authorized tenant/user documents. Never send cross-tenant chunks to the LLM.
- Do not hard-code API keys; prefer Google Cloud service identity and environment variables.
- Keep all demo companies, people, emails and records fictional. UI and README must disclose this.
- Don't imply the app is production-compliant, enterprise certified, or legally approved.
- Tests must cover source lookup failure, fabricated excerpt rejection, conflicting date nuance, empty evidence and cross-tenant isolation.

## Working style
- Implement one vertical slice at a time. Keep the application deployable after each phase.
- Make minimal, reviewable commits and preserve the user's work.
- If time-constrained, remove P1; never substitute mock responses and claim AI works.
- Provide files changed, commands run, result/error summary, and next best task after every milestone.
- Treat `prompts/00-START-HERE.md` and subsequent prompts as the task sequence.

## Demo facts
`HBR-DOC-02`: Client target **2026-11-01**. `HBR-DOC-04`: latest QA completion forecast **2026-11-11**. `HBR-DOC-06`: production security approval **PENDING**. `HBR-DOC-09`: no revised delivery commitment authorized. No pilot is approved. Do not replace these with previous planning drafts or unverified dates.
