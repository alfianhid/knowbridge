# Paste this as your **first Codex prompt** in the repository

You are the lead engineer for KnowBridge, our Google Cloud AI Builder Cup 2026 submission. We are two developers, targeting Singapore SMEs that use Google Workspace, with an internal submission goal of October 17, 2026.

Read `AGENTS.md`, `README.md` and every file in `docs/` before changing code. The app has a Next.js scaffold and already-generated synthetic near-enterprise corpus: 168 Docs, 24 Sheets, 1,904 rows, 12 gold tests. This is a starting kit, NOT a finished AI app. Do not invent success claims or fake citations.

First: inspect current repository and run the available seed integrity test, unit tests, typecheck, and build. Report exact results. Then create a short execution plan and implement the **first vertical slice**: import a bounded batch of local synthetic docs/sheets with stable source IDs and metadata, then expose `GET /api/sources` and a source details panel. Work in reviewable increments. Respect tenant/source access checks and synthetic disclosure.

For Cloud Run and Gemini, use current official Google SDK documentation; verify model availability for region before selecting a concrete model ID. Follow `docs/BACKLOG.md` P0 order. Ask for secrets only at the point they are required; never print or commit secrets. Do not build Gmail, Calendar, multi-agent orchestration or a graph visualization.

After this step, list changed files, commands run/results, tests to verify, remaining blockers and the exact next Codex prompt to use.
