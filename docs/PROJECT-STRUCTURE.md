# Project structure and cleanup policy

KnowBridge is a single Next.js application with a grounded-answer pipeline, durable evidence storage and an optional Workspace connector. Keep that deployable unit small. A separate service, workspace package or generic agent framework is not needed for the current two-developer prototype.

## Research and decisions

The following primary documentation informed the conservative cleanup on 2026-10-18:

- [Next.js project structure](https://nextjs.org/docs/app/getting-started/project-structure): Next.js supports `src/`, colocation and private folders, but does not prescribe one application layout. Keep its route/configuration conventions and use folders where they clarify ownership. This project remains on Next.js 15; the cleanup does not adopt newer framework APIs.
- [Google Cloud RAG architecture](https://docs.cloud.google.com/architecture/rag-capable-gen-ai-app-using-vertex-ai): separates ingestion, serving and quality evaluation. That is useful as a responsibility model here; its infrastructure choices are not a reason to replace Firestore or split this app into services.
- [Knip's Next.js plugin](https://knip.dev/reference/plugins/next) and [entry-file guidance](https://knip.dev/explanations/entry-files): dependency analysis must understand framework entry points. Operator CLIs, test fixtures, Docker commands and dynamically loaded modules also need explicit consideration before deletion.

Our recommendation is to retain the existing app paths, separate current documentation from recorded evidence, and remove only dependencies/files proven unused. A future feature-folder migration should be its own reviewed change.

## Folder responsibilities

```text
src/
  app/                 Next.js pages, layouts and API route entry points
  components/          Browser UI panels
  lib/                 Existing server services, contracts and storage adapters
  middleware.ts        Existing Next.js 15 request middleware
scripts/               Ingestion, indexing, evaluation and maintenance CLIs
tests/                 Unit/integration/component checks
  e2e/                 Playwright browser journeys
seed/generated/        Deterministic fictional corpus and gold fixtures
public/                Browser-served fonts and images
assets/credits.json    Attribution for the public images
apps-script/           Optional native Docs/Sheets seeding
prompts/               Staged engineering task sequence
docs/
  README.md            Documentation navigation
  *.md                 Product contracts, current guides and shipping results
  archive/             Historical reports and original audit tickets
  evidence/evaluation/ Recorded benchmark runs, retries and diagnostics
  evidence/workspace/  Recorded isolation evidence
  deck/                Submission PDF, editable HTML, screenshots and template
```

Root package, TypeScript, Next.js, test, Docker and Firestore configuration files remain where their tools expect them. `.env`, `.secrets/`, `.data/`, `.taste-skill/`, dependency/build directories and browser reports are local ignored state. They are not deletion candidates merely because they are absent from Git.

## Application boundaries

Route handlers validate requests and enforce authorization before calling services. Existing source, retrieval, Gemini, semantic-validation, brief and Workspace modules retain their paths. Client panels should receive explicit data contracts rather than server storage or credential code.

Keep tenant/source authorization before model context construction. Preserve literal-source validation, temporal/approval distinctions, owner-scoped persistence and fail-closed errors. Moving a module must not bypass those boundaries.

If `src/lib/` becomes difficult to navigate, migrate one domain at a time into named areas such as sources, answers, briefs, Workspace and platform integrations. Update imports, test mocks, operator scripts and the maintenance Docker image together. Do not add empty feature folders or barrel exports in advance.

## Cleanup performed

- Moved 20 historical Markdown reports to `docs/archive/` and their original audit-ticket JSON alongside them.
- Moved 12 evaluation JSON records to `docs/evidence/evaluation/` and one isolation record to `docs/evidence/workspace/`. All 14 moved JSON files retain identical bytes; full runs, retries and diagnostics remain distinct.
- Updated repository Markdown links and repaired pre-existing Phase 5 README/deck links. The required product/architecture/dataset/backlog/API/evaluation paths remain stable.
- Removed unused direct dependencies `googleapis` and `@testing-library/user-event` using npm; retained the actually used `google-auth-library` and all live source files.
- Removed redundant `public/.gitkeep`; all fonts, images and their credit record remain.
- Excluded `.taste-skill/` and `*.tsbuildinfo` from the Docker context, matching existing Git exclusions.
- Changed deployed-evaluator defaults to ignored, timestamped `.data/evaluations/` files with distinct full-run/case names. Explicit `--out` paths still work and their parent directories are created.

Every app module and operator script had a live import, framework entry-point role, test, documented command or Docker/CI use. No unused application module was established. Static analysis tools such as Knip were not installed; findings came from repository-wide import/string tracing and independent read-only audits. This is a bounded audit, not proof that every export is necessary.

## Ongoing maintenance

1. Put setup and current contracts in the top-level documentation index. Put dated reports in the archive and reviewed raw results under evidence.
2. Keep generated corpus files: they are reproducible runtime inputs, not disposable build output. Preserve asset attribution and original evidence, including failed runs.
3. Before removing a file or package, check imports, dynamic loading, routes, scripts, tests, CI, Docker and documentation references. Unreferenced historical evidence is not automatically dead code.
4. Run seed verification, meaningful tests, lint, typecheck, build and Markdown link checks after structural changes. Use a clean dependency install when removing packages.
5. Promote new evaluation artifacts deliberately after checking scope and sensitive content. Do not commit local credentials or silently overwrite old outcomes.

## Cleanup verification (2026-10-18)

| Check | Result |
|---|---|
| `python scripts/verify_seed.py` | Pass: 168 documents, 24 sheets, 1,904 rows, 12 cases |
| `npm.cmd ci --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=30000` | Clean install passed; removed packages are absent, 25 lockfile entries pruned, no retained package versions changed |
| `npm.cmd test` | 263 tests passed across 35 files after clean installation |
| `npm.cmd run lint` and `npm.cmd run typecheck` | Passed |
| `npm.cmd run build` | Passed |
| `npm.cmd run ingest:local` with file/local modes | 18 existing sources skipped unchanged; zero failures |
| `npm.cmd run test:e2e` | Nine cases passed; the run's identified Windows test-server process required explicit termination for teardown, then the runner exited 0 |
| Evaluator output smoke checks | Local HTTP stub verified timestamped case defaults, nested explicit output, invalid-case rejection and preserved 503 failure reporting; no live model calls |
| Documentation/evidence checks | Local Markdown file targets resolve, all 14 moved JSON hashes match pre-move working files, and `git diff --check` passes |
| Independent reviews | Code and TypeScript reviews reported no actionable findings |

An initial offline `npm install` attempt failed with `ENOTCACHED` for `@axe-core/playwright`; the later network-enabled clean install succeeded. Existing Vitest config-loader, Next.js ESLint-plugin and npm deprecation warnings remain outside this cleanup. No new production reliability or model-accuracy claim follows from local tests.

No Cloud Run deployment, live model benchmark, cloud data cleanup or Git commit is part of this cleanup.
