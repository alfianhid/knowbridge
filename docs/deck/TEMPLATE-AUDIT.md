# Deck template audit — AI Builder Cup submission template vs KnowBridge deck

Reviewed 2026-10-18. Template source: `docs/deck/Submission Template _ AI Builder Cup.pdf` (16 pages, 720×405 pt). Our deck: `docs/deck/KnowBridge-Submission-Deck.html` → `KnowBridge-Submission-Deck.pdf` (16 slides, 1280×720 px).

## Section mapping (template → our deck)

| Template page | Section | Our slide | Notes |
|---|---|---|---|
| 1 | Team Details (a. team name, b. team leader, c. problem statement) | 1 | Now uses the template's exact a/b/c structure and cover banner |
| 2 | Note ("download this template…") | — | Meta instruction page, deliberately not reproduced |
| 3 | Brief about the idea | 2 | |
| 4 | Opportunities (differentiation / solution / USP) | 3 + 4 | Slide 4 is our extra comparison ("Why not just ask ChatGPT, Claude or Gemini?") filed under Opportunities |
| 5 | List of features offered by the solution | 5 | |
| 6 | Process flow diagram or Use-case diagram | 6 | |
| 7 | Wireframes/Mock diagrams of the proposed solution (optional) | 7 | |
| 8 | Architecture diagram of the proposed solution | 8 | |
| 9 | Technologies to be used in the solution | 9 | |
| 10 | Estimated implementation cost (optional) | 10 | |
| 11 | Snapshots of the prototype | 11–13 | Expanded to three slides (landing/Ask, grounded answer/catalog, Workspace/brief) so each shot stays readable |
| 12 | Prototype Performance report/Benchmarking | 14 | |
| 13 | Additional Details/Future Development (if any) | 15 | |
| 14 | Provide links to your: GitHub repo / demo video (3 min) / final product | 16 | |
| 15–16 | Blank + "Thank you" closing image | 17 | Slide 17 reproduces the template's closing "Thank you" page (rendered from the template PDF itself); the blank spare slide is deliberately not reproduced |

All template sections are covered 1:1 and the template's closing page is included as the final slide; deviations are additive only (one extra Opportunities slide, three snapshot slides instead of one).

## Design comparison and changes applied

| Aspect | Template | Before | After (now) |
|---|---|---|---|
| Theme | Light: white slides, black text | Dark `#0e1116` with blue accent | White slides, black/gray text per template |
| Branding | Black top bar with **Google Cloud · AI Builder Cup · Hack2Skill (H2S)** on every content slide; full banner + trophy on the cover; thin black strip at page bottom | None | Identical chrome: `assets/banner-strip.jpg` top bar + `assets/banner-cover.jpg` cover banner + 7px bottom strip (logos extracted from the template PDF itself) |
| Typography | Google Sans (SemiBold titles 16 pt, regular body 13 pt on 720×405 pt pages) | Segoe UI, 38 px titles | Google Sans/Roboto stack, 28 px titles + bold subheads, scaled ×1.78 from template metrics |
| Slide titles | Plain section names ("Brief about the idea", …) | Editorial headlines with small kicker labels | Template section names as the h2; editorial line kept as bold subhead |
| Cover | Banner top ~53%, then "Team Details" + a/b/c | Editorial cover, kv list | Template layout reproduced (banner 380 px, a/b/c) |
| Page geometry | Top bar 40 pt (10%), title x=28 pt, bottom strip 4 pt | 56/80 px padding, no chrome | Top bar 71 px, title x=50 px, bottom strip 7 px — matches template proportions |

Brand images in `docs/deck/assets/`: `banner-cover.jpg`, `banner-strip.jpg` (extracted from the template PDF; black `#000` bars merge seamlessly with the JPEG backgrounds).

## Stale content found and updated (2026-10-18)

1. **Screenshots** — all four were pre-18-October captures: retired blue UI, old "Singapore-first" eyebrow, no judge sign-in/onboarding. Re-captured all six from the deployed Cloud Run release (`knowbridge-00021-tft`): landing hero, Ask panel (prefilled Harbour question, grounded answer via gemini-3.8-flash), literal citations with recorded/effective dates, source catalog (HBR-DOC-02), Workspace panel, Decision brief panel (judge session). The "historical live captures" caveat was removed.
2. **Test counts** — "273 tests / 8 semantic regressions" → **279 tests across 38 files** and **11/11 adversarial semantic regressions (incl. prompt injection)**, both re-verified 18 Oct (`npm test`, `scripts/check-semantics.ts`).
3. **Seed stats** — re-verified: 168 docs / 24 sheets / 1,904 rows / 12 cases (PASS).
4. **Demo video link** — published 2026-10-19: https://youtu.be/KihSKFj2nCw (3:30, within the 3-to-4-minute rule). Clickable on the links slide (16) and the prototype snapshots slide (13); the "not yet produced" placeholder was removed.
5. **Stale notes in docs** — the "273 tests / historical screenshots" paragraph in the deck outline, `README.md`, `SUBMISSION.md` replaced with current facts.

Benchmark figures (2/12 latest complete deployed runs, 9/10/11-of-12 earlier runs, 49,509.5 ms median latency) were reviewed and left unchanged: they remain the latest recorded measurements and are labelled as historical checkpoints.

## Intentional deviations from the template

- Slide 4 (comparison with general AI assistants) — extra slide under "Opportunities"; content required by the project working rules and backlog.
- Three "Snapshots of the prototype" slides instead of one — keeps every screenshot legible at print size.
- Slide 17 is the template's closing "Thank you" page (rendered from the template PDF); the template's blank spare slide (page 15) is skipped.
- Links (GitHub, demo video, final product) are clickable URL annotations in the PDF.
- Small semantic colors retained (green PASS, amber PENDING/missing) in an otherwise monochrome scheme for status legibility.

## Verification

- PDF (regenerated 2026-10-19): 17 pages, `@page` 1280×720, programmatic bounds check — no text outside slide area on any page, no blank pages.
- **Blank-slide root cause fixed 19 Oct**: the earlier PDF drew all text with Type3 glyph fonts (Skia's fallback for the Google Fonts *variable* Roboto webfont), which many PDF viewers and converters render as empty/blank slides. The deck now self-hosts static Roboto TTFs (`assets/fonts/`), so text embeds as standard PDF fonts and renders everywhere. Gate: zero `/Type3` fonts in the output PDF.
- Link check: clickable URL annotations on slides 13 and 16 (demo video ×2, GitHub repo, live app).
- Page-by-page visual review of the rendered PDF (cover, brief, comparison, features, process flow, snapshots ×3, performance, roadmap, links, closing).
- Regenerate: `node .data/print-deck.cjs` (Playwright/Chromium `page.pdf`, `printBackground`, `preferCSSPageSize`).
