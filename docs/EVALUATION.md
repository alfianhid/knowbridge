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
