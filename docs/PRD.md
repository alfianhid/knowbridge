# KnowBridge — 1-page Product Requirements

**One-line:** an evidence-backed decision copilot for Google Workspace–using SMEs, starting in Singapore.

## Customer hypothesis
Owners, delivery/project managers, operations leads at 10–100-person services SMEs on Google Workspace. Knowledge is fragmented among Docs and Sheets. Users struggle to determine which statement is current and what they can actually commit to. Product-market fit is unvalidated; judge the *prototype*, do not claim real-world adoption.

## Hero user story
As a project leader, I want to ask “Can Project Harbour launch on 1 Nov?” and receive the source-backed original commitment, newer QA forecast, outstanding security approvals, alternatives and unknowns—without reading 5–10 documents myself.

## P0 screens
1. **Workspace / Corpus:** indicate Demo Synthetic mode or connected source mode; show indexed document count and status.
2. **Ask:** free-text question input; citations and evidence side panel.
3. **Decision Brief:** recommendation, evidence claims, contradiction/timeline findings, alternatives, outstanding unknowns and next step.
4. **Saved Briefs:** list and reopen decisions, with reviewedByHuman indicator.

## Required functionality
- Offline seed import of all 168 documents and 24 sheets (or a reproducible bounded subset on Cloud Run if needed), with stable source IDs and provenance.
- Gemini embeddings (768D), Firestore vector search or documented deterministic retrieval fallback when index unavailable locally.
- Use Gemini to synthesize **from retrieved evidence only**; structured output validated with Zod and verified quote spans.
- Distinguish newer QA forecast from earlier **customer expectation**; they differ in meaning, rather than labeling raw date inequality as a contradiction.
- User-specific/tenant-specific document filtering BEFORE context is given to the model.
- Persist saved briefs with questions, evidence, model and timestamp for demo; all writes idempotent if retried.
- Non-hallucination behavior: unknown answer with missing evidence.

## P1
Google sign-in and Google Picker-based selection with narrowly scoped drive.file permission; native export of Docs and single-tab Sheets; minimal entity linking.

## Explicitly out of scope
Gmail and Chat sync, editing real Drive files, organization-wide crawling, automated decisions/actions, production permission replication, policy compliance certification, multi-agent workflow engine, Neo4j/RDF/OWL, automated cloud billing controls.

## Acceptance demo
A judge opens deployed link, sees synthetic demo disclosure, asks hero question and receives verified citations to fictional source documents, a timeline discrepancy, explicit security pending, and a saved Decision Brief. An unknown question produces an abstaining response. App works on Cloud Run.
