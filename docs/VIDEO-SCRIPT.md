# KnowBridge — demo video script (2:50, Phase 5 draft, 2026-10-17)

Record on the live deployment: https://knowbridge-208529907910.asia-southeast1.run.app (revision `knowbridge-00011-xx4`). All data shown is fictional synthetic data — say so once on screen and in the first narration line. Every result quoted below is a recorded measurement; do not restate a pass that was not recorded.

Total runtime target: **2:50** (hard limit 3:00).

---

**00:00–00:20 — Problem and user scenario**
Screen: hero — "Know what your sources *actually say.*" with the synthetic badge and "55 imported sources".
Narration: "KnowBridge is a fictional demo for Google Workspace SMEs. One question matters before a launch commitment: can we actually commit to this date? The evidence lives across many files — and the files disagree."

**00:20–00:45 — Synthetic dataset and import**
Screen: Source catalog — 8 projects (Harbour, Meridian, Northstar, Orchard, Beacon, Atlas, Juniper, Cedar) with source IDs, recorded dates and original text.
Narration: "The corpus is fully synthetic: 168 documents, 24 sheets, 1,904 rows — verified by a deterministic seed check. Every record keeps its literal text, recorded date and effective date. Nothing here is real customer data."

**00:45–01:15 — Ask with genuine citations**
Screen: Ask panel typing "Can we commit to launching Project Harbour on 2026-11-01? Identify conflicting evidence and recommend a next step." — show the synthesized answer and two citations.
Narration: "Ask runs on Gemini over Firestore vector retrieval. Every claim carries a literal, click-through excerpt. If the corpus does not contain the answer, the system says 'insufficient evidence' — it abstains rather than invents."

**01:15–02:00 — Timeline mismatch, security gate, evidence explanation**
Screen: scroll the answer's conflict section; click through to `HBR-DOC-02` and `HBR-DOC-04` source detail showing original text.
Narration: "The conflict is temporal and real: the client expects 2026-11-01, recorded October 7th. The latest QA forecast is 2026-11-11 — a forecast, not a revised commitment. Security approval is still pending. The answer keeps these typed: customer target, QA forecast, pending approval — a forecast never erases a customer expectation."

**02:00–02:25 — Decision Brief with unknowns**
Screen: Decision brief panel — brief created, showing claims, conflicts, alternatives, unknowns; point at the human-review control.
Narration: "The Decision Brief turns this into an auditable recommendation with options, risks and explicit unknowns. It is a conditional recommendation for a human decision-maker — review is recorded deliberately, and nothing is ever an autonomous approval."

**02:25–02:45 — Architecture and actual test results**
Screen: slide/graphic — Cloud Run + Gemini + Firestore, and the results line.
Narration: "Cloud Run in Singapore, Gemini generation, Firestore vectors. 256 automated tests pass. The 12-case benchmark on the deployed service: honest numbers — two of twelve in both final runs, earlier runs at nine, ten and eleven of twelve. Failures are intermittent provider-side service errors, reported exactly as measured."

**02:45–02:50 — Call to action**
Screen: hero tagline + links (public repo, live demo).
Narration: "KnowBridge. Know what your sources actually say."

---

## Recording checklist

- Use the deployed URL only; do not record localhost.
- Show at least one full citation click-through to source original text.
- Keep the synthetic-data disclosure visible in the first 20 seconds.
- Do not claim production compliance, legal approval, Singapore-only processing or measured productivity improvement.
- Final result numbers must match the [Phase 5 results record](PHASE5-RESULTS.md) at recording time.
