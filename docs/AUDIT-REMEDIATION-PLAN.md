# Phase 1 audit remediation plan

Authorized: 2026-10-13. Scope: resolve issues #1–#20 before Phase 2; update tracker #21 using verified results.

1. Preserve confirmed Phase 1 changes and credential exclusions (#19).
2. Connect ingestion and reads through durable file/Firestore stores, atomic hash updates and explicit statuses (#1, #6, #16).
3. Enforce Firebase admin identity, fixed public synthetic scope, bounded requests and distributed ingestion quota (#4, #7).
4. Reject evidence-free supported briefs; validate literal quotes and construct authoritative metadata (#2, #3).
5. Upgrade vulnerable dependencies with verified compatibility (#5).
6. Fix focus, live announcements, title wrapping, keyboard scrolling, selection semantics, navigable source sections and decorative branding (#9–#15).
7. Add interaction/browser/security checks, hardened container configuration and precise documentation (#8, #16–#18).
8. Run seed integrity, typecheck, unit/integration tests, production build, standalone/browser checks and dependency audit. Review independently. Close only tickets whose criteria are proven.

Patterns: TypeScript source services in `src/lib`, Next API handlers returning controlled JSON errors, Vitest tests under `tests`, synthetic source IDs from manifest. No existing persistent repository or identity verifier exists; add focused modules rather than refactoring unrelated code.

Local file storage is explicitly development-only. Cloud Run requires Firestore and managed service identity. Missing cloud settings fail visibly. No embeddings, Gemini synthesis, Drive import or Phase 2 APIs are added.

Cloud checks use the supplied credential only via ADC; no key contents may be logged or copied into artifacts. Existing external configuration must not be silently changed. If Firestore/IAM/auth setup is unavailable, finish all independent work and report the exact remaining requirement.
