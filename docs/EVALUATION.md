# Evaluation and demonstration rubric

Machine-readable fixtures: `seed/generated/evaluation.json`. Source IDs in gold examples must remain stable across seed regeneration.

## Required tests
1. **Cross-document recall:** For all 8 projects, retrieve the latest QA forecast and distinguish it from earlier client expectations.
2. **Harbour hero:** Target `2026-11-01`, QA forecast `2026-11-11`, security `PENDING`, no approved revised commitment/pilot; recommendation conditional and cites HBR-DOC-02, -04, -06, -09.
3. **Temporal change:** Identify updated QA forecast as new information, not proof that the earlier customer expectation was never made.
4. **Superseded policy:** Effective revision 2 of Launch Readiness policy governs; not revision 1.
5. **Abstention:** Personal mobile number and other absent information must not be generated or inferred.
6. **Missing approval:** A draft pilot plan cannot be represented as signed customer approval.
7. **Literal citation validation:** Every evidence excerpt appears in authorized original source. Demonstrate negative test.
8. **Tenant isolation:** Documents from an unrelated tenant must never reach prompt context or appear in output.
9. **Synthetic disclosure:** Demo clearly says fictitious records and no real customer data.
10. **Repeatability:** Deterministic queries can be evaluated twice with similar retrieved evidence; record run timestamp, model and parameters.

## Reporting format
| Metric | What to record |
|---|---|
| Case pass rate | Exact total passed / total 12; separately note model variability |
| Citation validity | Claims with matching authorized excerpts / total cited claims |
| Missing-evidence abstention | Unknown cases abstained / total unknown cases |
| Conflict interpretation | Does output explain why two apparently mismatched sources differ? |
| Median end-to-end latency | Actual seconds for completed demo queries |
| Ingestion time/cost | Actual cloud timings/usage if available, not fabricated savings |

Pass/fail is initially a human-reviewed rubric for semantic recommendations, supplemented by deterministic programmatic checks for dates, authorizations, source IDs and excerpt text. There is no claim the fixture set proves production accuracy.

## Executable gates added for #23/#24/#28

`npm.cmd run ingest:local -- --corpus=evaluation` imports the bounded evaluation profile locally; use the [cloud instructions](RETRIEVAL.md) to import/index it in Firestore. `tests/corpus.test.ts` verifies all fixture IDs, eight-project local recall, both policy revisions, provenance, retries and isolation. This is corpus/retrieval coverage, not a model benchmark.

`node --env-file=.env scripts/run-typescript.cjs scripts/check-semantics.ts` runs eight live source-linked semantic regressions. It rejects launch impossibility from forecasts alone, erased customer expectations, QA completion, unsupported security/pilot/customer approval and unsupported feasibility language. It accepts the contextual negative “No signed revised commitment is evidenced in the decision log” and a conditional recommendation retaining target/forecast/security distinctions. Results go to ignored `.data/semantic-regressions.json`. Do not evaluate `prohibited_claims` by substring: the gold word “signed” also appears in correct negative statements.

Ask first validates literal citations, then a separate structured Gemini assessment classifies each claim/unknown as baseline, client expectation, forecast, commitment, approval, policy, recommendation or unknown. Every statement must receive exactly one supported verdict; contradicted, uncertain, missing/duplicate/out-of-range verdicts fail closed. There is one regeneration retry, then 502. Provider review failures return 503. Model abstention text is replaced with server-owned wording. A model reviewer reduces risk but does not prove entailment; human semantic review remains mandatory.

`finalizeVerifiedDecisionBrief` prepares the same gate for Phase 3 claims, conflicts, recommendations, alternatives, next steps and unknowns after server-authoritative citation enrichment. It always discards model review flags; insufficient evidence without factual claims yields a fixed abstention. Brief APIs remain unimplemented. A generated recommendation is never an autonomous or approved decision.

`node --env-file=.env scripts/run-typescript.cjs scripts/evaluate.ts` runs all 12 actual Ask queries through Firestore vectors and Gemini, pacing queries to the existing quota. It requires complete stored fixture-source coverage, records source IDs, exact-citation checks, expected date/status coverage, failures and measured latency in ignored `.data/evaluation-results.json`. It writes partial results after each case and exits nonzero on any automated failure. Read automated pass/fail separately from `humanReviewed:0` and `humanSemanticPasses:null`; source-ID/fact checks are not substitutes for human interpretation. Report actual failures; never count a stored/unindexed fixture as passed. Configuration, source model and generation settings accompany each run; model variability needs repeat runs if assessed.

Human rubric: verify original expectation and forecast separately, approval authority and scope, conditional recommendation, missing customer/pilot evidence, literal supporting excerpts, current policy effective revision and absent-data abstention. Record reviewer/date and case-specific reasons. A person must inspect high-impact recommendations before use. See [carried acceptance](ACCEPTANCE.md) for manual accessibility criteria and [remediation results](ISSUE-REMEDIATION.md) for actual outcomes.

For a focused retry, append `--case=CASE-NTH` (or another exact fixture ID). This runs one case and writes a distinct retry artifact. Keep full-run results and report variability; do not present an aggregate of selected retries as one clean 12-case run. Fact coverage checks require exact target/QA dates and security status in claim text; dates appearing only in citations do not satisfy that answer-completeness check.
