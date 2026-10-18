# Recorded evidence

These JSON records were moved without changing their bytes. Keep each full run, focused retry and diagnostic separate. A focused pass cannot turn a failed full run into a clean benchmark pass.

## Evaluation

Files in [evaluation/](evaluation/) retain their original names:

- `evaluation-results-2026-10-15.json`: earlier recorded attempts, explained in the [dated evaluation report](../archive/EVALUATION-RESULTS-2026-10-15.md).
- `evaluation-results-2026-10-17.json` and `evaluation-rerun1-2026-10-17.json`: separate local CLI full runs.
- `evaluation-retry-CASE-UNKNOWN-01-2026-10-17.json` and `unknown-diagnostic-followup-2026-10-17.json`: focused evidence, not full runs.
- `deployed-evaluation-2026-10-17.json`: the earlier deployed full run.
- `deployed-evaluation-prefix-2026-10-17.json` and `deployed-evaluation-postfix-2026-10-17.json`: full runs before and after the timeout change.
- The four `deployed-eval-retry-CASE-*.json` files: separate deployed focused retries.

Interpret results using [Phase 5 results](../PHASE5-RESULTS.md), the [Workspace follow-up](../archive/WORKSPACE-FOLLOWUP-2026-10-17.md) and the [evaluation methodology](../EVALUATION.md).

## Workspace isolation

[The isolation record](workspace/workspace-isolation-followup-2026-10-17.json) supports the bounded temporary-member check described in the [follow-up report](../archive/WORKSPACE-FOLLOWUP-2026-10-17.md). It does not prove two independently consented accounts.

## New runs

The deployed evaluator now writes timestamped full-run or case-specific JSON under ignored `.data/evaluations/` by default. `--out=<path>` still selects an explicit output location and creates its parent directory. Review an artifact for synthetic-data scope and credentials before deliberately adding it here. Never overwrite a recorded run to hide a failure.

No live model benchmark was run as part of the repository cleanup.

## UI release

[UI polish verification, 18 October](UI-POLISH-2026-10-18.md) records revision `knowbridge-00019-cc8`, 273 tests and a focused cited Harbour query on the preceding UI revision. It is not a new full benchmark. Separate sign-in checks were recorded internally.
