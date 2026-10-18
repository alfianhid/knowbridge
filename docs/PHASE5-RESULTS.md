# Phase 5 results — ship, benchmark, deploy and record (2026-10-17)

> The linked deck has since expanded to 14 slides and its test figures were refreshed on 18 October. Historical checkpoint. Revisions, counts and open tasks describe the recorded date. See [current readiness](READINESS.md) for superseding release, benchmark and submission status.

All demo companies, people and records are fictional. Feature freeze declared; this phase contains reliability, evaluation, security, documentation and submission-artifact work only. No mock response is presented as working AI; all measured numbers below are recorded outcomes.

## 1. Freeze and gates

| Gate | Command | Result |
|---|---|---|
| Seed verifier | `python scripts/verify_seed.py` | PASS — 168 documents, 24 sheets, 1,904 rows, 12 cases |
| Unit/integration/security | `npm test` | PASS — 256 tests, 34 files |
| Schema checks | `tests/contracts.test.ts` + Zod validation across APIs | PASS |
| Lint | `npm run lint` | PASS |
| Typecheck | `npm run typecheck` | PASS |
| Production build | `npm run build` | PASS |

Playwright e2e (9 browser cases) was not re-run in this phase; the last recorded pass is in [pre-Phase 5 audit](archive/PRE-PHASE5-AUDIT-2026-10-17.md).

## 2. Benchmark: 12 cases with recorded actual outcomes

Harness: `scripts/evaluate-deployed.ts` (new) runs all 12 fixtures from `seed/generated/evaluation.json` over HTTP against the deployed `/api/ask`, with independent `/api/sources` literal-citation verification and the same scoring as `scripts/evaluate.ts`. Focused single-case retries are kept as separate artifacts and never aggregated into full-run totals.

| Run | Revision | Outcome | Median latency (incl. failures) | Artifact |
|---|---|---|---|---|
| Pre-fix full run | `knowbridge-00011-xx4` | **2/12** — 10 failures, all HTTP 503 service failures | 49,509.5 ms | [deployed-evaluation-prefix-2026-10-17.json](evidence/evaluation/deployed-evaluation-prefix-2026-10-17.json) |
| Focused retry CASE-HBR | `knowbridge-00011-xx4` | PASS (24,624 ms) | — | [retry artifact](evidence/evaluation/deployed-eval-retry-CASE-HBR-2026-10-17.json) |
| Focused retry CASE-HBR-SPECIFIC | `knowbridge-00011-xx4` | FAIL (503, 59,944 ms) | — | [retry artifact](evidence/evaluation/deployed-eval-retry-CASE-HBR-SPECIFIC-2026-10-17.json) |
| Focused retry CASE-UNKNOWN-01 | `knowbridge-00011-xx4` | FAIL (503, 60,553 ms) | — | [retry artifact](evidence/evaluation/deployed-eval-retry-CASE-UNKNOWN-01-2026-10-17.json) |
| Focused retry CASE-POLICY-01 | `knowbridge-00011-xx4` | FAIL (503, 59,198 ms) | — | [retry artifact](evidence/evaluation/deployed-eval-retry-CASE-POLICY-01-2026-10-17.json) |
| Post-fix full run | `knowbridge-00012-n6t` | **2/12** — 10 failures, all HTTP 503 service failures (5 fast provider rejections at 6–12 s; 5 at the raised 120 s model-call timeout) | 19,749 ms | [deployed-evaluation-postfix-2026-10-17.json](evidence/evaluation/deployed-evaluation-postfix-2026-10-17.json) |

Historical complete runs remain separate evidence: 9/12, 10/12 (revision `knowbridge-00009-7j5`), 11/12 (local CLI), 3/12 (local CLI network failures). Totals are never combined.

### Failure diagnosis (documented, then fixed where freeze-safe)

- **Class A — model-call timeout (fixed):** failing cases clustered at ~59–60 s: `src/lib/gemini.ts` set a 60 s SDK timeout on `generateContent`, and a timeout in `generateGrounded` escapes the retry loop (the call sits outside its `try`), failing the request closed with 503. Fix applied: generation/semantic timeouts 60 s → 120 s, embedding default 30 s → 60 s. Tests updated and green (256/256). Deployed as revision `knowbridge-00012-n6t`.
- **Class B — provider-side unreliability (open):** after the fix, residual 503s arrive in two shapes: fast provider-side rejections in 2–12 s (generation/embedding stage) and model calls exceeding even the raised 120 s timeout (failures cluster at 115–128 s). Both final full runs recorded 2/12 with different passing cases (pre-fix: CASE-ORC, CASE-CDR; post-fix: CASE-MER, CASE-UNKNOWN-02), which shows availability variance rather than content-specific failures. The application correctly fails closed with no fabricated answer. No permission or quota cause is asserted; the application intentionally logs only generic messages. Raising timeouts further would collide with the Cloud Run 300 s request ceiling under the pipeline's sequential model calls. Full-suite reliability under these intermittent provider failures remains **open**.
- Failed cases in every run are recorded as `automatedPassed:false` with `errorStatus` and message; no failure was an evidence-quality failure among passing cases (all passes had fully valid literal citations, required-source coverage and fact coverage).

## 3. Cost and latency documentation

- Latency: per-case measured and median (including failures) recorded per run in the artifacts above. Request counts per run are recorded (`askCalls`, `sourceLookups`); the pre-fix run used 12 ask calls and 11 source lookups, each ask call internally performing embedding, generation and semantic review with up to two validation attempts.
- Dollar cost: **not measured.** Billing export/budget APIs are not accessible to this account from the operator workstation; only request/attempt counts are recorded. No dollar figure is claimed.

## 4. Cloud Run permissions review and mutation protection

- Invocation: `roles/run.invoker` → `allUsers` (intentional public demo; application authorization protects all private/mutating surfaces).
- Runtime identity: dedicated service account `knowbridge-runtime@project-abfa2050-4777-4f90-bf0.iam.gserviceaccount.com` with exactly `roles/aiplatform.user`, `roles/datastore.user`, `roles/firebaseauth.viewer`.
- Secrets (`GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_PICKER_API_KEY`) mounted from Secret Manager; no credentials in env output, images or repo.
- Unauthenticated mutation probes (recorded 2026-10-17): `POST /api/decision-briefs` → 401, `POST /api/ingest` → 401, `POST /api/workspace/import` → 403, `POST /api/workspace/disconnect` → 403, `POST /api/workspace/oauth/start` → 403. Brief creation additionally requires `Idempotency-Key`; reads are rate-limited and pinned to the synthetic demo tenant.
- Traffic note: the pre-fix deploy revealed traffic pinned to the old revision; `--to-latest` promotion was applied. `knowbridge-00012-n6t` now serves 100% and future deploys auto-promote.

## 5. Deployment and real-model confirmation

- Deployed URL: https://knowbridge-208529907910.asia-southeast1.run.app — serving revision `knowbridge-00012-n6t` (image `sha256:8930…59d6`), region `asia-southeast1`.
- Real Gemini responses confirmed on the deployed URL: the browser Ask flow and the benchmark both return model-synthesized answers labeled "Gemini synthesis from retrieved evidence · gemini-3.8-flash" with literal citations; the deterministic local mode is disclosed as "no AI synthesis" and is not used on Cloud Run. No mock endpoint is presented as working AI.

## 6. GitHub public safety

- Secret scan of tracked files: clean (only `.env.example` tracked; `.env`, `secrets/`, `.secrets/` ignored). Fictional-data disclosure present in UI and README.
- CI workflow "KnowBridge starter checks": latest run success.
- **Repository visibility changed PRIVATE → PUBLIC** on 2026-10-17 with user approval (`gh repo edit --visibility public`), verified `visibility: PUBLIC`.

## 7. README

Updated with exact instructions: [benchmark evaluation commands](../README.md#benchmark-evaluation) (all three run modes, scoring rules, no-aggregation rule) and [deploy commands](../README.md#deploy) (gcloud project/API/database/service commands, env/secret requirements, post-deploy verification steps), plus the mutation-protection summary.

## 8. Submission artifacts

- 8-slide deck outline with actual screens/results: [DECK-OUTLINE.md](DECK-OUTLINE.md); rendered 8-page PDF: [deck/KnowBridge-Submission-Deck.pdf](deck/KnowBridge-Submission-Deck.pdf) (source [deck/KnowBridge-Submission-Deck.html](deck/KnowBridge-Submission-Deck.html)).
- Under-3-minute video script (2:50) with actual screens and results: [VIDEO-SCRIPT.md](VIDEO-SCRIPT.md).

## 9. Artifact URL checklist

- [ ] Deployed app (judge-accessible): https://knowbridge-208529907910.asia-southeast1.run.app
- [ ] Public GitHub source: https://github.com/alfianhid/knowbridge
- [ ] Demo video (<3 min, public link): **not yet recorded** — script ready at [VIDEO-SCRIPT.md](VIDEO-SCRIPT.md)
- [ ] English deck PDF: [KnowBridge-Deck.pdf](deck/KnowBridge-Submission-Deck.pdf) (upload to submission portal)
- [ ] Submission portal registration + exact cutoff timezone: **unconfirmed — dashboard fact**

## 10. Unresolved issues

1. Full-suite benchmark reliability is **open**: intermittent provider-side 503s (Class B above) persist after the timeout fix; recorded totals stand as run artifacts and are never aggregated.
2. Dollar cost of evaluation/deployment is not measured (request counts only).
3. Demo video not yet recorded.
4. Competition-dashboard submission cutoff/timezone unconfirmed (external deadline Oct 18, internal target Oct 17).
5. Playwright e2e (9 cases) not re-run in this phase.
6. Human semantic review and accessibility acceptance remain user-reported without independent reproduction metadata ([acceptance record](ACCEPTANCE.md)); the deployed brief remains `reviewedByHuman:false`.
7. Real-data Workspace import remains prohibited by scope; only registered fictional files are permitted.
