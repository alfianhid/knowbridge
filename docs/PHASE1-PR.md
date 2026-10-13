Phase 1 ingestion now persists records and serves the catalog from the same store. Restarted imports skip unchanged records, metadata changes refresh citations, and malformed or unauthorized evidence is rejected.

The change adds Firebase admin authorization, bounded requests and shared ingestion quotas, hardened dependencies/container/headers, and accessible source selection, reading and retry behavior. AI remains disabled; Phase 2 has not started.

Verification: 40 unit/integration tests, 6 standalone Chromium checks, lint, typecheck, production build and full seed integrity passed. npm audit reports zero vulnerabilities. Real Firestore in asia-southeast1 imported 18 sources; a fresh-process retry skipped all 18 with zero failures.

Audit findings #1–#20 are tracked by #21. #18 awaits Linux container CI; do not close the tracker until that check passes. Credential folders are excluded from Git and Docker.
