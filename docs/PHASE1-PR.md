Phase 1 ingestion now persists records and serves the catalog from the same store. Restarted imports skip unchanged records, metadata changes refresh citations, and malformed or unauthorized evidence is rejected.

The change adds Firebase admin authorization, bounded requests and shared ingestion quotas, hardened dependencies/container/headers, and accessible source selection, reading and retry behavior. AI remains disabled; Phase 2 has not started.

Verification: 40 unit/integration tests, 6 standalone Chromium checks, lint, typecheck, production build and full seed integrity passed. npm audit reports zero vulnerabilities. Real Firestore in asia-southeast1 imported 18 sources; a fresh-process retry skipped all 18 with zero failures.

All 20 audit findings tracked by #21 are resolved. Linux container CI passed on commit `01cc5a7`, including actual image build/start, health response, non-root execution and seed-file availability. Credential folders are excluded from Git and Docker.

CI evidence: https://github.com/alfianhid/knowbridge/actions/runs/38441180169 and https://github.com/alfianhid/knowbridge/actions/runs/38441187427. The initial container health probe raced startup; bounded readiness retries fixed it and passed independent review.
