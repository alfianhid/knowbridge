# KnowBridge demo video - Evidence, attached.

Production plan reviewed **18 October 2026** against the [live application](https://knowbridge-208529907910.asia-southeast1.run.app/) through BrowserOS neo MCP, repository design tokens, and the installed official Remotion skills. **Production status: the Remotion project is implemented in the internal video project with a 3:30 cut (18 scenes, 6300 frames) matching the competition's 3-to-4-minute video rule. The six added scenes are storyboarded from the submission deck. Human re-review of the regenerated narration and captions is pending; final MP4 export remains held at the owner's request.**

**Deliverable:** English, 16:9, **3 to 4 minutes** per the competition video rule (current cut 3:30 / 6300 frames per the internal edit notes; earlier 2:50 and 2:00.4 assemblies sat below the rule's 3-minute floor and are superseded). Audience: AI Builder Cup judges and project leaders at Southeast Asian Google Workspace SMEs. Story: before promising a launch date, inspect what the evidence actually authorizes.

## Creative direction

Begin with the actual soot hero, oversized **Evidence, attached.**, white Harbour evidence card and lime **Ask the record** action. Move into white work surfaces and the lime **What the record shows** table. Finish with a reviewable brief and human responsibility. Emotional progression: uncertainty, inspection, clarity, accountable action.

Follow one fictional project. Avoid an exhaustive feature tour, stock office montages, robots, holograms, or unmeasured productivity promises.

| Element | Production direction |
|---|---|
| Canvas | Edit at 1920x1080, 30 fps. Capture real UI at that resolution or higher; confirm actual capture dimensions. |
| Palette | Soot #0f0f0f, white #ffffff, warm paper #f5f5f2, lime #dafa9c, gray #555555. See [tokens](../tokens.css). |
| Type | Switzer if available; otherwise one consistent clean sans-serif. Monospace for source IDs and original text. |
| Framing | Crop to the task. Never shrink the whole long page into frame. Leave 96 px side margins and bottom 140 px clear for captions. |
| Motion | One focal action per shot. Straight cuts, restrained 200-300 ms dissolves, screenshot pushes from 100% to 106% over 5-8 seconds. No perspective tilt on evidence text. |
| Cursor | One cursor, deliberate movement, brief pause before clicking. Remove exploratory movement. |
| Voice | Calm adult English narrator; warm, precise, natural international or Singapore/SEA English. No forced accent or announcer voice. Spoken passages around 125-140 words/minute. |
| Music | Quiet instrumental pulse around 90-100 BPM, no vocals; roughly 18-24 dB below narration. Lower further during source reading. |
| Mix | Suggested master around -16 LUFS integrated, true peak at or below -1 dBTP. Check laptop-speaker intelligibility. |
| Captions | Sentence case, maximum two lines. Manually verify dates, Harbour, Gemini and source IDs. Do not cover evidence. |

Show **Fictional demo data - Human verification required** on opening and closing cards. Keep app disclosures visible during product footage. Generated visual bridges must not masquerade as customer records.

## Remotion production strategy

Use Remotion to compose genuine app recordings, screenshots, editable graphics, narration and captions into one deterministic timeline. Preserve captured source evidence; never recreate an application result as an illustrative React screen. Abstract paper-card bridges can be simple React/SVG animations, without generative video.

**Status: implemented.** The Remotion project lives in [`video/`](../video/) with its own package manifest and lockfile, isolated from the deployed Next.js application. No production video dependency was added to the web app. Frame counts in this document describe the original 170-second assembly and are preserved as the production specification; the user-requested compact edit (120.4 s / 3613 frames, same narration wording and factual safeguards) supersedes them — see the internal edit decision list for authoritative current timings.

### Composition contract

- Main composition ID: `KnowBridgeDemo`; 1920x1080; 30 fps; **6300 frames** in the current cut, representing [0, 6300), last visible frame 6299 (3:30.0, inside the competition 3-to-4-minute window). Historical: original assembly 5100 frames (2:50) and compact edit 3613 frames (2:00.4), both below the rule's 3-minute floor and superseded.
- In scene components, derive fps with `useVideoConfig()`. Express seconds-to-frames timing using that fps. Drive animation with `useCurrentFrame()` and clamped `interpolate()`; use easing deliberately. No CSS transitions/keyframes, wall-clock timers or browser autoplay to drive animation.
- Follow the installed skill's successive-scene pattern: named `Track`, distinct scene instances, and `Interactive.create()` scenes registered as connected compositions. Give each independently editable scene, clip and overlay its own JSX node with inline timing/props. Avoid a `.map()` that makes independently editable clips share one source node.
- Use straight cuts as the baseline. If using overlapping `TransitionSeries` transitions, subtract the overlaps from total duration and recalculate narration/caption alignment. The frame table below assumes no scene overlap. Fades within a scene do not change its length.
- Use `<Video>` and `<Audio>` from `@remotion/media`, and `<CanvasImage>` for screenshots, as directed by the installed markup skill. Verify APIs against the project's pinned version before implementation; keep Remotion packages aligned. Reference sanitized local assets with `staticFile()` from the video project's `public/` directory.
- Keep video, its clip-relative captions and evidence annotations in one shared timing group when they must move/trim together. Apply trim/rate timing once to that group. A continuous master narration track and its captions instead use composition-relative timing; do not accidentally restart them in every scene.
- Load locally available fonts and wait for font readiness before measuring text. Resolve asset/metadata loading through Remotion-supported loading mechanisms; fail visibly on missing assets. Rendering must not call the live app, model API or a signed-in browser session.
- Preview in Studio first. A later video-building task should open the exact Studio URL early and verify the composition preview. Export the full MP4 only when requested; this script update starts neither Studio nor rendering.

### Frame-accurate edit decision list

Ranges are start-inclusive, end-exclusive. Timings match the narration sections below at 30 fps. This table is the authoritative current cut and matches `video/src/edl.json`.

| Scene | From (seconds) | Start frame | Duration frames | End frame exclusive |
|---|---:|---:|---:|---:|
| 01 Opening | 0.0 | 0 | 204 | 204 |
| 02 Problem | 6.8 | 204 | 360 | 564 |
| 03 Workflow | 18.8 | 564 | 330 | 894 |
| 04 Product | 29.8 | 894 | 300 | 1194 |
| 05 Question | 39.8 | 1194 | 300 | 1494 |
| 06 Answer | 49.8 | 1494 | 450 | 1944 |
| 07 Decision semantics | 64.8 | 1944 | 330 | 2274 |
| 08 Date gap | 75.8 | 2274 | 330 | 2604 |
| 09 Source proof | 86.8 | 2604 | 480 | 3084 |
| 10 Catalog | 102.8 | 3084 | 330 | 3414 |
| 11 Abstention | 113.8 | 3414 | 288 | 3702 |
| 12 Brief | 123.4 | 3702 | 520 | 4222 |
| 13 Workspace | 140.7 | 4222 | 384 | 4606 |
| 14 Architecture | 153.5 | 4606 | 333 | 4939 |
| 15 Differentiation | 164.6 | 4939 | 420 | 5359 |
| 16 Results | 178.6 | 5359 | 392 | 5751 |
| 17 Roadmap | 191.7 | 5751 | 330 | 6081 |
| 18 End card | 202.7 | 6081 | 219 | 6300 |

Use these literal frame counts for a 30-fps edit, or derive them from seconds using the composition fps. Do not change fps without regenerating this table and verifying every trim, animation and caption boundary.

## Master storyboard and exact voiceover

These eighteen scenes total **210 seconds (3:30)**, inside the competition's 3-to-4-minute requirement. Read only the blockquoted narration. Timing includes silent reading and cursor actions. All product actions below are **capture requirements**, not claims this planning session performed them.

### 01 - 00:00-00:07 - The question before the promise

**Picture:** soot background; three blank paper rectangles sit slightly out of alignment. A fine lime line links them. At 00:03, cut to the real hero headline. Show fictional-data disclosure immediately.

> Before you promise a launch date, what does the evidence actually say? This demo uses fictional records.

**Motion/audio:** optional React/SVG paper-card bridge for first three seconds. One quiet paper sound. Let the word evidence land on the real hero. Add every word in editing.

### 02 - 00:07-00:19 - The cost of a wrong commitment

**Picture:** warm-paper storyboard built in Remotion: three white record cards - customer target **2026-11-01** (`HBR-DOC-02`), QA forecast **2026-11-11** (`HBR-DOC-04`), security sign-off **PENDING** (`HBR-DOC-06`) - appear one by one, then the line **Nothing reconciles them.** Keep the fictional-data disclosure visible.

> Project commitments are scattered across files: a customer target in one document, a QA forecast in another, a security sign-off in a third. Nothing reconciles them.

**Motion/audio:** staggered card reveals, about a quarter second each. Fixed example records only; no generated answer appears in this scene.

### 03 - 00:19-00:30 - One workflow

**Picture:** Remotion-built workflow strip on warm paper: **Connect - Investigate - Reconcile - Decide** with one-line descriptors (selected files; grounded questions with citations; dates, conflicts, authority; a brief for human review). One lime connector advances through the four stages.

> KnowBridge follows one workflow: connect selected files, investigate with grounded questions, reconcile dates and conflicts, then decide from a reviewable brief.

**Motion/audio:** connector advances over the first eight seconds. This diagram explains the workflow; it is not a live request trace.

### 04 - 00:30-00:40 - Meet KnowBridge

**Picture:** real hero screenshot or recording. Establish wordmark, headline, Ask the record action and fictional-source count. Move toward the white Harbour evidence card, retaining its date and source link.

> Meet KnowBridge: evidence-backed decision support for Google Workspace SMEs. Every answer should bring its quote, its source, and its date.

**Motion:** 4% push toward the card, then hold. The hero card is a fixed illustrative example, not a response just generated by the user.

### 05 - 00:40-00:50 - Ask one consequential question

**Picture:** click **Ask the record**. Choose **Launch readiness**, show the populated multiline **Question** field, then click **Ask**. Preserve a short genuine loading state.

> A project leader asks: can we commit to launching Project Harbour on the first of November?

**Exact question:**

```text
Can we commit to launching Project Harbour on 2026-11-01? Identify conflicting evidence and recommend a next step.
```

**Edit:** shorten waiting with a visible **Processing time shortened** label. Never imply an instantaneous response or splice in a result from another question.

### 06 - 00:50-01:05 - An answer you can inspect

**Picture:** actual successful answer from that recorded request. Establish the response, then crop to one supported claim and its evidence control. Retain the real mode/model disclosure if shown. Keep the question visible in the establishing shot.

> KnowBridge retrieves authorized evidence, asks Gemini to reason over it, and checks the returned citations. You can inspect the source behind the answer.

**Motion:** cursor pauses on one citation. Add the editorial label **Inspect the evidence** outside the app boundary. Do not overlay a fabricated answer. If generation fails, use the recovery plan below.

### 07 - 01:05-01:16 - Four kinds of date

**Picture:** Remotion-built comparison on warm paper listing the four typed semantics with their Harbour records: **Baseline** (client target 2026-11-01, HBR-DOC-02), **Forecast** (2026-11-11, HBR-DOC-04), **Commitment** (none authorized, HBR-DOC-09), **Approved decision** (approval pending, HBR-DOC-06).

> Not all dates carry equal authority. A baseline, a forecast, a commitment, and an approved decision are different things. KnowBridge keeps those types distinct.

**Motion/audio:** rows reveal in order. Fixed example records; do not label the difference a proven impossibility of launch.

### 08 - 01:16-01:27 - The ten-day gap

**Picture:** real lime **What the record shows** table. Highlight first and second rows sequentially. Add an Remotion-built comparison beside the recording:

```text
1 Nov - client target       HBR-DOC-02
11 Nov - QA forecast        HBR-DOC-04
10 days apart
```

> The client target is November first. The newer QA forecast is November eleventh: ten days later. A forecast does not authorize a new delivery commitment.

**Motion:** target, then forecast, then gap. Hold for at least four seconds. This fixed example table is not the generated answer. Do not label the difference a proven impossibility of launch.

### 09 - 01:27-01:43 - Prove the distinction

**Picture:** one complete real citation interaction from answer to source content. Then inspect **Project Harbour - QA Forecast** in the catalog and expand **Original source text**. Keep **HBR-DOC-04**, recorded date **2026-10-10**, and the literal forecast sentence readable. Cut to security and decision-log table rows or originals.

> Open the original record. The date is a QA forecast, not completed work. Security approval is pending, and no revised delivery commitment is authorized. No pilot is approved.

**Motion:** thin lime underline under actual forecast text. Never replace or retype a quotation. Briefly label **Source recorded date**, then **Approval status**. Do not imply that the security record's body date is a launch date.

### 10 - 01:43-01:54 - Every source stays inspectable

**Picture:** the catalogue portion of the genuine citation-to-original recording: registered sources with identifiers and recorded dates, **Project Harbour - QA Forecast** selected, **Original source text** expanded. Annotations: **HBR-DOC-04 - recorded 2026-10-10**, **Original source text - literal excerpt**.

> Every registered source stays inspectable: identifiers, recorded dates, and original source text, so you can check what the record actually says.

**Motion/audio:** gentle push toward the expanded original text. Never replace or retype a quotation.

### 11 - 01:54-02:03 - Absence is an answer

**Picture:** choose **Absent evidence** in Ask, submit, and show an actual **insufficient evidence** result. Read the selected question before capture; use the seeded missing personal-information scenario. Hold the actual abstention.

> When the corpus has no answer, the right response is insufficient evidence. Missing information must stay missing, rather than becoming a confident invention.

**Motion/audio:** direct cut; remove the music pulse for one beat. Result must come from the actual request. If unavailable, use the honest alternate below.

### 12 - 02:03-02:21 - From evidence to a reviewable brief

**Picture:** cut to an already authenticated judge session, credentials outside frame. Establish **A recommendation, never an approval.** Enter the same Harbour question in **Decision question**, click **Create brief**, and capture a genuine completed brief. Show recommendation, options/risks, unknowns and evidence. Refresh the saved list and reopen the same saved item.

> For a human decision-maker, KnowBridge prepares a structured brief with options, risks, unknowns, and supporting evidence. Save it, reopen it, and inspect the record before acknowledging review. Review is not business approval.

**Motion:** two readable crops instead of a rapid full-page scroll. Capture save/reopen continuity. If including **Mark evidence reviewed**, inspect the evidence first and click deliberately. Do not stage an approval state.

### 13 - 02:21-02:34 - Controlled connection

**Picture:** current **Import is explicit, bounded and reversible.** section. Show Workspace disclosures and controls. Add editorial label **Optional connector - registered fictional files only**.

> The optional Workspace connector accepts selected, registered fictional files. Imported evidence stays separate from public search and seed-based briefs. Real-data import is outside this demo.

**Motion:** slow crop across disclosure and disconnect control. Do not click disconnect for decoration. Default shot demonstrates the panel, not completed import. Substitute genuine verified import footage only if recorded; never imply imported files produced Scene 08's seed-based brief.

### 14 - 02:34-02:45 - Google AI with a clear boundary

**Picture:** Remotion-built diagram on warm paper:

```text
Authorized sources -> Firestore retrieval -> Gemini -> Validation -> Cited answer / brief

Next.js on Cloud Run
Cloud Run: Singapore | Generation: global | Embeddings: US
```

> Built on Cloud Run, Firestore, and Gemini. Source access is checked before model context is sent. Hosting is in Singapore; model processing is not Singapore-only.

**Motion:** one lime connector advances through five stages. Use editable shapes and exact text. This diagram explains architecture; it is not a live request trace.

### 15 - 02:45-02:59 - Why not just ask a general assistant?

**Picture:** Remotion-built two-column comparison on warm paper: **General assistants** (broad knowledge, open-ended work, fast drafts) versus **KnowBridge adds** (verified literal citations, typed date semantics, abstention on absent evidence, tenant-scoped retrieval before the model, a saved brief with human review). Disclose: **KnowBridge itself runs on Gemini.**

> Why not just ask a general assistant? General models win on broad knowledge. KnowBridge adds the workflow around the model: verified literal citations, typed date semantics, abstention, and tenant-scoped retrieval.

**Motion/audio:** columns reveal in sequence. Frame this as a design comparison of typical general-assistant behaviour, not a measured head-to-head benchmark.

### 16 - 02:59-03:12 - Honest results

**Picture:** readable evidence card with both columns equally prominent:

```text
LOCAL CHECKS                  LATEST COMPLETE DEPLOYED BENCHMARKS
279 tests passed              2/12 in each recorded run
                              10 HTTP 503 failures per run

Fictional seed: 168 documents | 24 sheets | 1,904 rows | 12 gold cases
Recorded evidence: 17-18 October 2026 | Full-suite reliability remains open
```

> Two hundred seventy-nine local tests pass. Model reliability remains open: both latest complete deployed benchmarks passed two of twelve, with ten service failures each. We report those limits openly.

**Motion:** hold the card throughout the scene. No green benchmark badge, combined retry score, or success-percentage animation. Sources: [Phase 5 results](PHASE5-RESULTS.md), [readiness](READINESS.md), [UI release evidence](evidence/UI-POLISH-2026-10-18.md). Refresh only when newer comparable evidence exists.

### 17 - 03:12-03:23 - What comes next

**Picture:** Remotion-built roadmap card on warm paper: **P1 - enterprise Workspace depth (approved scope only)** and **P2 - Gmail, Chat and Calendar connectors, SSO (post-hackathon)**, closing on the CTA **Know what your sources actually say.**

> Next is deeper Google Workspace integration within approved scope, then Gmail, Chat and Calendar connectors after the hackathon. Know what your sources actually say.

**Motion/audio:** planned scope only; label it **Planned scope - not shipped functionality**. Do not imply these features exist today.

### 18 - 03:23-03:30 - Close on the promise

**Picture:** real hero, then soot end card with wordmark and lime rule. Full live URL on screen; repository link in published description.

> KnowBridge. Evidence, attached. Know what your sources say before you commit. Try the fictional demo.

```text
KnowBridge
Evidence, attached.
knowbridge-208529907910.asia-southeast1.run.app
Fictional demo data - Human verification required
```

**Motion/audio:** optional one-second abstract bridge; hold final card at least five seconds. Soft music resolution, no impact sound.

## Screenshot and recording manifest

All nine assets below were captured at 1920×1080 (18 October capture round) and human-approved the same day; the inventory is recorded in the internal asset list. Older [deck screenshots](deck/assets/) predate the current UI. Keep raw captures locally under ignored `.data/video/raw/`. Review selected captures before copying to the isolated video project's `public/captures/`. Never copy raw sessions or credentials into a public asset directory.

| Planned asset | Capture instructions and required proof | Scene |
|---|---|---|
| 01-hero.png | Top of live page, desktop view: wordmark, headline, CTA, fictional disclosure and count | 01, 02, 12 |
| 02-ask-submit.mp4 | Sample selection, exact question, genuine submit and loading | 03 |
| 03-answer-citations.mp4 | Same request after completion: question, real answer, evidence controls and mode | 04 |
| 04-evidence-table.png | Tight frame around all four rows, IDs, dates and approval states | 05, 06 |
| 05-citation-original.mp4 | Unbroken citation-to-source action; QA catalog selection and original expansion as needed | 06 |
| 06-insufficient-evidence.mp4 | Actual absent-evidence request and abstention | 07 |
| 07-brief-create.mp4 | Authenticated session after credentials hidden: question, creation, completed sections | 08 |
| 08-brief-reopen.mp4 | Refresh list and reopen same saved brief; content continuity | 08 |
| 09-workspace.png | Current panel, fictional-only/processing disclosures and controls | 09 |
| Architecture scene component | Editable React/SVG diagram from Scene 10 | 10 |
| Results scene component | Editable React typography and metrics, dated and scoped | 11 |
| End-card scene component | Editable name, URL and disclosure | 12 |

### Capture recipe

1. Record the deployed app with a dedicated fictional judge session. Disable notifications and hide password-manager overlays. Exclude credentials, tokens, account menus, clipboard history and private tabs.
2. Start at 100% browser zoom. Check a 1080p preview; use closer crops or higher recording resolution rather than unreadably small text.
3. Record five seconds of stillness before and after each action. Keep complete raw requests even when the edit shortens waiting.
4. Capture public Ask and sources first. Sign in off-camera before brief footage. Judge sign-in does not grant Drive consent.
5. Select Harbour QA rather than the default Atlas source. Expand **Original source text**. Verify **HBR-DOC-04** and **2026-11-11** before export.
6. Adapt narration to actual model output. Never inject a preferred answer into the DOM or create a synthetic success screen in the composition.
7. Inspect source evidence before acknowledging review. Record the actual review state, never an implied launch approval.

## Remotion motion and asset implementation brief

### Suggested project structure (planned, not created)

```text
video/
  package.json                # separate video dependencies and scripts
  src/index.ts                # entry point
  src/Root.tsx                # main and connected composition registrations
  src/KnowBridgeDemo.tsx       # authored scene instances and master audio
  src/scenes/                 # twelve named editable scenes
  src/components/             # EvidenceHighlight, Disclosure, Captions, ScreenshotFrame
  public/captures/             # sanitized genuine recordings and screenshots
  public/audio/                # narration.wav, licensed music, optional subtle effects
  public/fonts/                # licensed local Switzer files or approved fallback
  public/captions/             # narration.json in Caption format
  public/provenance.json       # capture dates, request/source correspondence, edit notes
  out/                        # ignored review frames and requested final export
```

Use stable asset names from the manifest. Provenance should describe the capture and any shortened waits without tokens, account details or credentials. Keep originals outside public assets. Pin dependencies and retain the video lockfile for repeatable production.

### Opening and closing animation

For Scene 01, draw three blank paper cards as SVG rectangles on soot. Animate their positions into one aligned stack during the first three seconds; draw the lime connector with frame-driven stroke progress. Hold still briefly before motion. Cut to the real hero at three seconds. Do not draw invented document text.

For Scene 12, optionally draw a short lime underline before revealing the wordmark. Place the full URL in editable text. Hold the final card from no later than second 165 to the end, giving at least five seconds of reading time. No perspective movement or decorative particles.

### Screenshots and evidence highlights

Use unchanged source images through `staticFile()` and `<CanvasImage>`. Animate their parent container's scale from 1 to at most 1.06, with clamped interpolation and a deliberate focal point. Keep the readable citation, date and source ID inside frame. Use a fixed crop and `contain` where evidence would otherwise be cut off; never stretch the screenshot.

Highlights are separate thin rules or translucent boxes positioned against known capture dimensions. Store the target bounds with that capture, and recheck them after every crop or asset replacement. Highlights must point at existing text; they cannot replace it. Prefer stillness while a viewer reads a quotation.

### Architecture and results

Build Scene 10 as editable React text and SVG connectors. Animate one connector at a time using local scene frames. Scene 11 uses two equal-weight columns and remains static while narration states the metrics. Keep local tests separate from deployed model outcomes. Do not animate a counter toward a false combined score.

### Voiceover and audio

Record narration in one session or use one licensed TTS voice. Keep a dry WAV master. Direction:

```text
One calm adult English narrator. Warm, clear, quietly confident; natural international or Singapore English, no forced accent. A thoughtful product builder demonstrating evidence, not an advertising announcer. Respect sentence pauses. Emphasize target versus forecast versus approval. Pronounce Harbour like harbor, Gemini as JEM-in-eye, and QA as Q A. Preserve all supplied factual wording. No added claims, slogans, laughter, music or sound effects.
```

Fit narration to the existing scene slots with natural pauses; do not stretch a short line across its whole slot or accelerate speech to force runtime. Align the final spoken word of each passage before its scene ends. Audition dates and benchmark lines first. Add music using a separate audio layer with frame-driven fades/ducking, not CSS or browser volume changes. Do not clone another person's voice without permission.

### Captions

Use JSON in `Caption[]` format from `@remotion/captions`: each entry has `text`, `startMs`, `endMs`, `timestampMs` and `confidence` (the latter two can be null). Generate or align timestamps from the **final recorded narration**, not estimated word lengths. Keep timings in milliseconds in caption data and convert to frames using the composition fps only when required.

For the continuous narration master, use one composition-relative caption track. If narration is split into independently editable clips, attach clip-relative captions and overlays to each clip's shared timing group so trims and speed changes remain synchronized. Choose one timing basis per track; do not combine global timestamps with scene-local frames without the scene offset.

Use restrained phrase-level captions, two lines maximum. Manually proof dates, source IDs and approval language. Export an SRT/VTT sidecar from the same reviewed timing data if required by the publishing platform. Avoid karaoke effects over evidence text.

## Preview, validation and eventual export

1. Prepare genuine captures and approved audio. Review every public asset for secrets. No live-service requests or sign-in may be required to render the video.
2. In the separate video project, implement `KnowBridgeDemo` and its twelve connected scenes using the frame table. Keep the web application unchanged.
3. Open Studio early with the entry point, for example `npm.cmd run dev -- --no-open --port=3100` from `video/`. Open the exact printed URL with BrowserOS neo and verify the preview.
4. Scrub each scene start, middle and final frame, plus frames immediately around cuts. Confirm no gaps, clipping, unreadable crops or unexpected opacity. Check the first frame and the final visible frame (5099 in the original assembly; 3612 in the current compact cut) specifically.
5. Play through narration, music and captions. Verify shared trims and overlays stay aligned. Read the last URL at normal playback speed.
6. Once a project exists, review a still before full export, for example:

```powershell
# Run from the proposed video project only after implementation.
npx.cmd remotion still src/index.ts KnowBridgeDemo out/results-review.png --frame=4380
```

7. When an MP4 export is explicitly requested, use the pinned local CLI. Example:

```powershell
npx.cmd remotion render src/index.ts KnowBridgeDemo out/knowbridge-demo.mp4 --codec=h264 --audio-codec=aac --pixel-format=yuv420p --crf=18
```

Use either CRF or `--video-bitrate`, not both. If input props are needed on Windows, pass `--props=props.json` instead of inline shell JSON. Commands are templates until the project/assets exist; do not claim a render pass from this document.

8. Inspect the actual exported file for 1920x1080, 30 fps, the current edit's duration (120.4 s), audio sync, caption alignment and readable evidence. Compare rendered stills to original captures. Publishing and submission remain separate tasks.

## Failure and schedule recovery

| Problem | Honest replacement |
|---|---|
| Ask returns 502/503 | Retain raw error footage. Retry deliberately within budget. Use a successful genuine take if obtained, with waiting cuts disclosed. Otherwise show sources and say: The service is unavailable in this take; these are the stored records. |
| Absent-evidence result unavailable | Show the real error or inspect sources and say: The system is designed to abstain when evidence is missing; this take did not complete. |
| Brief creation unavailable | Show a real prior saved brief labelled **Previously saved brief**. Say: A saved brief preserves options, risks, unknowns and evidence for review. If none exists, show the form and disclose unavailable generation. |
| Judge access unavailable | Film public Ask and sources. Label protected controls as features requiring sign-in; never fabricate an authenticated session. |
| Screenshot becomes blurred or annotation drifts | Reduce scale, correct crop/coordinates and render a review still against the original capture. |
| Workspace takes too long | Keep capability-panel shot. Do not imply import completed. |
| Narration runs long | Cut optional bridges and cursor travel. Preserve evidence proof, approval distinctions, real results and human-review boundary. |

## Final factual and delivery checks

- [ ] Every demonstrated product result is actual captured output; no generated UI or staged DOM changes.
- [ ] Fixed hero example and evidence table are not presented as newly generated answers.
- [ ] Client target **2026-11-01**, **HBR-DOC-02**; QA forecast **2026-11-11**, **HBR-DOC-04**.
- [ ] Security **PENDING**, **HBR-DOC-06**; no revised commitment authorized, **HBR-DOC-09**; no pilot approved, **HBR-DOC-15**.
- [ ] Recorded/effective dates and Drive updates remain distinct. Forecast is not completion or approval.
- [ ] At least one real citation-to-original interaction stays readable.
- [ ] Saved/reopened brief appears only if genuinely captured. Human review never means launch approval.
- [ ] Workspace remains optional, registered-fictional-only and separate from public seed Ask/briefs.
- [ ] No real-data import, broad sync, production compliance, Singapore-only processing or measured productivity benefit claimed.
- [ ] **279 local tests** remain separate from **2/12 in each latest complete deployed benchmark**, ten HTTP 503 failures each. No aggregation of retries.
- [ ] Captions and narration agree on dates, counts, limitations and approval states.
- [ ] No credentials or private details visible. Preserve provider-added provenance marks.
- [ ] Suggested export: MP4/H.264, 1920x1080, 30 fps, AAC; CRF 18 starting point. Confirm 3613 frames (current edit), no gaps/overlaps, resolved assets/fonts, and deterministic frame-driven animation.
- [ ] Inspect actual resolution, sync, legibility and duration. Watch muted, on laptop speakers, then at normal speed without pausing.
- [ ] Final runtime below three minutes; final URL readable for at least five seconds.
- [ ] Add published URL to [submission checklist](SUBMISSION.md) only after production and upload. Submission confirmation remains separate.

## Published description template

```text
KnowBridge - Evidence, attached.

Evidence-backed decision support for Google Workspace SMEs, built with Gemini on Vertex AI, Firestore and Cloud Run.

Demo: https://knowbridge-208529907910.asia-southeast1.run.app
Source and evaluation: https://github.com/alfianhid/knowbridge

All demo organizations, people, emails and records are fictional. Generated recommendations require human verification. Review acknowledgement is not business approval. Workspace import is restricted to registered fictional files. Model processing is not Singapore-only.

Recorded results: 279 local tests passed. Latest complete deployed benchmark runs each passed 2/12, with ten HTTP 503 failures per run. Full-suite model-service reliability remains open. Shortened request waits are labelled.

Production note: composed with Remotion using actual application captures and editable motion graphics. Use this statement only after producing the video with this workflow.
```

## Verification scope and references

BrowserOS neo inspection on 18 October confirmed live hero styling, 55-source disclosure, Ask sample controls/multiline question, four-row table, Judge access, Workspace disclosures/controls, brief form and Harbour QA catalog selection. This planning pass did **not** submit new model queries, sign in, import files, create a brief or acknowledge review. Result/authenticated shots remain capture tasks. Screenshots inspected during planning are visual references, not a delivered asset pack.

Project references: [readiness](READINESS.md), [Workspace boundaries](WORKSPACE.md), [Phase 5 benchmark evidence](PHASE5-RESULTS.md), [UI release](evidence/UI-POLISH-2026-10-18.md).

Remotion guidance: installed official skills `remotion-best-practices`, `remotion-markup`, `remotion-render` and `remotion-captions`, plus markup references for multi-scene videos and editable clip timelines. Their current guidance informs the composition plan; verify API availability against the pinned version during implementation.

Official references: [frame-driven animation](https://www.remotion.dev/docs/use-current-frame), [local assets](https://www.remotion.dev/docs/staticfile), [render CLI](https://www.remotion.dev/docs/cli/render), [caption data](https://www.remotion.dev/docs/captions/caption), [agent skills](https://www.remotion.dev/docs/ai/skills). No Remotion project, dependency install, Studio session, capture or render was created by this documentation update.
