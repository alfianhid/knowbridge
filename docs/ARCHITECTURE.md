# Architecture and technology ADR

## Decision
Single Next.js/TypeScript app on **Cloud Run**, server APIs with **Firebase Admin** (Firestore + optional Firebase Auth verification), **Google Gen AI SDK** with **Vertex AI/Gemini**. Documents initially loaded from `seed/generated`; live Google Picker/Drive later. Avoid extra vector DB, Kubernetes and separate Python API.

### Pipeline
```
Seed text/CSV  OR Google Picker selected Docs/Sheets
 -> Source adapter (stable sourceId, title, project, effective date, sourceUrl, tenantId, access)
 -> text normalizer + CSV contextualization
 -> deterministic 500-800-token chunks (sourceId + chunk ordinal)
 -> Gemini embedding-001 outputDimensionality=768
 -> Firestore collection(s) per tenant or tenant ID constrained queries + vector index
 -> top-k retrieval filtered to allowed user/tenant sources before model prompt
 -> Gemini structured evidence answer / Decision Brief
 -> Zod schema validation + literal quote/source-ID verification
 -> saved brief with review state
```

### Firestore shape (proposed)
- `tenants/{tenantId}`: name, synthetic flag.
- `tenants/{tenantId}/sources/{sourceId}`: type, title, sourceUrl, owner, projectId, recorded/effective date, indexedAt, access policy, content hash.
- `tenants/{tenantId}/chunks/{chunkId}`: sourceId, chunkIndex, body, embedding (Firestore VectorValue), metadata, allowedReaders if appropriate.
- `tenants/{tenantId}/briefs/{briefId}`: question, DecisionBrief JSON, creator, reviewedAt, model ID, retrieval source IDs.

**Security rule:** With Admin SDK and server-side queries, Firestore Security Rules do *not* enforce server access. Verify identity in API, authorize tenant and source membership before retrieval, and re-check returned chunks before Gemini sees them. For first demo, use a *single isolated synthetic tenant with read-only public access and restricted write APIs*, or verified Firebase Auth; never deploy a publicly writable ingestion API.

**Firestore vector note:** Vector index dimension must match stored vectors. Firestore supports max 2048 dimensions; choose 768. For scoped vector queries use composite indexes where necessary. Run vector index creation commands based on current gcloud SDK documentation and actual deployed schema.

**Google model note:** Look up a currently available Gemini Flash model and ensure it works in your chosen Vertex AI location. Do not invent a specific model ID. App should fail explicitly with missing settings. Use a managed Cloud Run service identity with least-privilege Vertex AI/Firestore permissions.

**Google Drive note:** `drive.file` + Google Picker provides per-file access for your app. Drive files.export for Docs -> text/plain; for Google Sheets -> text/csv (first tab). Multi-sheet retrieval is P1/P2 via Sheets API. A seeded historical date in a document is NOT equivalent to its newly created Drive modifiedTime.

## Fault handling
- Unsupported question/no indexed data -> insufficient evidence, no fabricated quote.
- Gemini schema parse failure -> retry once with invalid response diagnostics, then explicit failure.
- Citation validator failure -> remove unsupported claim or abstain; do not display a fabricated footnote.
- API/quotas unavailable -> show controlled error and existing saved decisions, not silent fallback to fake AI.
- Rate-limit ingestion; make source idempotent by content hash; batch operations and avoid duplicate embeddings.

## Cost/scope
Keep initial project docs ~500-800 tokens/chunk; cap demo ingest (e.g. top 24 Docs + 3 Sheets initially) so the first working slice can be proven cheaply. Expand to 192 sources after pipeline is stable. Add timeouts, retries, limits and budgets/alerts before bulk embedding.

Useful docs:
- https://firebase.google.com/docs/firestore/vector-search
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export
- https://googleapis.github.io/js-genai/index.html
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings
