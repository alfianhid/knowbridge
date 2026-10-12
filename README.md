# KnowBridge — Google AI Builder Cup 2026

> **Connecting knowledge to confident decisions.**
>
> Decision intelligence for Google Workspace–using SMEs, initially Singapore (English-first).

**Status:** This archive is a **Codex development starter**, not a finished AI prototype. It includes a runnable Next.js skeleton, schema validation, realistic synthetic data generator, Apps Script Workspace seeder, contracts and detailed Codex implementation prompts. Gemini/Firestore retrieval, Drive import and decision APIs must still be implemented. The `/api/health` endpoint intentionally reports `aiEnabled:false`.

## Start here

1. Install Node.js 22 and Python 3.11+; authenticate to your own Google Cloud account for later cloud work.
2. `npm install`
3. `npm run seed:verify` (or `python scripts/verify_seed.py`)
4. `npm run dev`, open http://localhost:3000 and http://localhost:3000/api/health
5. Open this repository in **Codex**, paste **`prompts/00-START-HERE.md`**, then use the staged prompts in `prompts/`.
6. For native demo Google Docs/Sheets, follow `apps-script/README.md` (recommended after the offline indexed workflow works).

## What is included

- **168** synthetic documents and **24** synthetic Sheets (**1,904** rows), 8 projects, 30 fictional staff, 8 revisioned policies, realistic lifecycle updates
- 12 expected-answer evaluation scenarios, including missing approvals, baseline-vs-forecast conflicts, and abstention
- `seed/generated/seed_bundle.json` for Google Apps Script creation of **native Docs/Sheets** in a test account
- `src/lib/contracts.ts`: structured, source-linked `DecisionBrief` with basic literal-excerpt verification
- `docs/`: specification, architecture, data semantics, product backlog, API contracts, testing and submission guide
- `AGENTS.md`: Codex operating rules, safety and delivery priorities
- `Dockerfile`: Cloud Run build container

## Target product journey

Select or load Docs/Sheets → extract & index → ask a question → show grounded answer and citations → identify timeline/conflict issues → generate a decision brief (options, risks, missing data, next step) → save for human review.

**Hero question:** “Can Project Harbour safely commit to launching on 2026-11-01?” Source `HBR-DOC-02` preserves customer expectation of 2026-11-01, while `HBR-DOC-04` forecasts QA complete on 2026-11-11, `HBR-DOC-06` says security approval is pending, and `HBR-DOC-09` says no revised commitment is approved. All records are fictional.

## Deadline and rules

Team formation closes **2026-10-14**, final project submission **2026-10-18**. Aim to submit **2026-10-17**. Requirement: Google AI model and Google Cloud hosting through Cloud Run or Firebase; deployed link, public GitHub repository, English PDF deck and demo video under 3 minutes. Confirm dashboard cutoff timezone.

- https://aibuildercup.com/themes.html
- https://aibuildercup.com/Faqs.html
- https://aibuildercup.com/

## Data warning

**THIS DATASET IS SYNTHETIC** and is not actual Google Workspace customer data. The invented North Quay Digital Pte. Ltd. and its employees/vendors/clients are for testing. The example.com email domain is reserved. Do not make factual or compliance claims on the strength of generated data. Do not push cloud service-account keys, OAuth secrets, access tokens or actual organization data into this repository.

## Next commands

```bash
npm install
python scripts/verify_seed.py
npm test
npm run dev
# For deterministic regeneration:
python scripts/generate_seed.py
```

All Google AI features are **TODOs**, not mock achievements. See `docs/ARCHITECTURE.md` and `prompts/` for implementation order.
