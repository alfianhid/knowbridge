import { createHash, randomUUID } from 'node:crypto';
import { ApiError, authorizeChunks, type AccessScope, type BriefIdentity } from './access';
import { assertBriefOwner, briefIdempotencyId } from './brief-access';
import { getBriefStore, type BriefStore, type StoredBrief } from './brief-store';
import { DecisionCoverageError, requireDecisionCoverage } from './decision-semantics';
import { DecisionBriefSchema, type DecisionBrief } from './contracts';
import { finalizeVerifiedDecisionBrief } from './verified-brief';
import { assessSemantics, generateDecisionBrief, getAIConfig } from './gemini';
import { checkRetrieved, selectQuestionSources } from './retrieval';
import { getSourceStore } from './source-store';
import { DEMO_TENANT_ID, type IngestionStore, type SourceChunk, type SourceRecord } from './sources';
import { retrieveVectors } from './vector-retrieval';

// Briefs require Vertex AI: no deterministic fallback brief is produced.
export function requireVertexMode(): void {
  const mode = process.env.KNOWBRIDGE_RETRIEVAL ?? (process.env.K_SERVICE ? 'vertex' : 'local');
  if (mode !== 'vertex') throw new ApiError(503, 'Decision briefs require Vertex AI retrieval.');
  getAIConfig();
}

export interface CreateBriefInput {
  question: string;
  idempotencyKey: string;
}

export interface BriefDependencies {
  store?: IngestionStore;
  briefs?: BriefStore;
  retrieve?: typeof retrieveVectors;
  generate?: typeof generateDecisionBrief;
  assess?: typeof assessSemantics;
  now?: () => Date;
  newId?: () => string;
}

function requestHash(tenantId: string, ownerUid: string, question: string): string {
  return createHash('sha256').update(JSON.stringify([tenantId, ownerUid, question])).digest('hex');
}

// Builds a brief only after authorized retrieval, exact citation checks and semantic review pass.
export async function createDecisionBrief(identity: BriefIdentity, input: CreateBriefInput,
  dependencies: BriefDependencies = {}): Promise<StoredBrief> {
  requireVertexMode();
  const config = getAIConfig();
  const store = dependencies.store ?? getSourceStore();
  const briefs = dependencies.briefs ?? getBriefStore();
  const hash = requestHash(identity.tenantId, identity.uid, input.question);
  const idempotencyId = briefIdempotencyId(identity, input.idempotencyKey);

  const existing = await briefs.findIdempotent(identity.tenantId, idempotencyId);
  if (existing) {
    if (existing.requestHash !== hash) throw new ApiError(409, 'Idempotency key was already used for a different request.');
    return existing.brief;
  }

  const available = (await store.list(identity.tenantId)).filter(source => source.tenantId === identity.tenantId && source.synthetic);
  const records = selectQuestionSources(input.question, available, { tenantId: identity.tenantId, sourceIds: new Set(available.map(source => source.id)) });
  const scope: AccessScope = { tenantId: identity.tenantId, sourceIds: new Set(records.map(source => source.id)) };
  const sources = new Map(records.map(source => [source.id, source]));
  const retrieved = records.length ? await (dependencies.retrieve ?? retrieveVectors)(input.question, scope) : [];
  const chunks: SourceChunk[] = checkRetrieved(authorizeChunks(retrieved, scope), sources, scope);

  let brief: DecisionBrief;
  if (!chunks.length) {
    brief = abstention(input.question);
  } else {
    brief = await generateVerified(input.question, chunks, sources, store, scope, dependencies);
  }

  const now = (dependencies.now ?? (() => new Date()))();
  const record: StoredBrief = {
    id: (dependencies.newId ?? randomUUID)(),
    tenantId: DEMO_TENANT_ID,
    ownerUid: identity.uid,
    question: input.question,
    createdAt: now.toISOString(),
    mode: 'vertex',
    model: config.model,
    sourceAttribution: attribution(brief, sources),
    brief,
    reviewedByHuman: false,
  };
  const { brief: saved } = await briefs.createOnce(record, idempotencyId, hash);
  return saved;
}

function abstention(question: string): DecisionBrief {
  return DecisionBriefSchema.parse({
    question, status: 'insufficient_evidence', recommendation: 'Insufficient evidence; no decision recommendation.',
    supportingClaims: [], conflicts: [], alternatives: [], unknowns: ['No sufficient authorized evidence found for this question.'],
    suggestedNextStep: 'Collect authorized source evidence for human review.', reviewedByHuman: false,
  });
}

// Two generation attempts. Diagnostics are server-owned feedback, never model-supplied text.
async function generateVerified(question: string, chunks: SourceChunk[], sources: Map<string, SourceRecord>,
  store: IngestionStore, scope: AccessScope, dependencies: BriefDependencies): Promise<DecisionBrief> {
  let diagnostics: string | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    // Re-read originals before generation and again before saving; changed sources fail closed.
    const current = await refreshSources(store, scope, chunks);
    const generated = await (dependencies.generate ?? generateDecisionBrief)(question, chunks, diagnostics);
    try {
      const modelBrief = { ...(typeof generated === 'object' && generated !== null ? generated : {}), question };
      const sourceMap = new Map(current.map(source => [source.id, source]));
      if (modelBrief && (modelBrief as { status?: string }).status === 'insufficient_evidence') {
        return abstention(question);
      }
      const finalized = await finalizeVerifiedDecisionBrief(modelBrief, sourceMap, dependencies.assess ?? assessSemantics, chunks);
      requireDecisionCoverage(question, finalized.supportingClaims.map(claim => ({ text: claim.claim, evidence: claim.evidence })), [...sources.values()], chunks);
      await refreshSources(store, scope, chunks);
      return finalized;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DecisionCoverageError) { diagnostics = error.message; continue; }
      diagnostics = 'Brief failed schema, literal citation or semantic evidence validation. Use only supplied source IDs and exact excerpts. Preserve client expectation, QA forecast, pending approval and authority. Do not state approvals, completion or revised commitments that the evidence does not record.';
    }
  }
  throw new ApiError(502, 'Generated brief failed evidence validation. Please retry.');
}

async function refreshSources(store: IngestionStore, scope: AccessScope, chunks: SourceChunk[]): Promise<SourceRecord[]> {
  const current = new Map<string, SourceRecord>();
  for (const sourceId of new Set(chunks.map(chunk => chunk.sourceId))) {
    const source = await store.get(scope.tenantId, sourceId);
    if (source && source.tenantId === scope.tenantId && scope.sourceIds.has(source.id)) current.set(sourceId, source);
  }
  checkRetrieved(chunks, current, scope);
  return [...current.values()];
}

function attribution(brief: DecisionBrief, sources: Map<string, SourceRecord>): { sourceId: string; contentHash: string }[] {
  const ids = new Set([
    ...brief.supportingClaims.flatMap(claim => claim.evidence.map(item => item.sourceId)),
    ...brief.conflicts.flatMap(conflict => [conflict.left.sourceId, conflict.right.sourceId]),
  ]);
  return [...ids].sort().map(sourceId => ({ sourceId, contentHash: sources.get(sourceId)?.contentHash ?? '' })).filter(item => item.contentHash);
}

export async function listDecisionBriefs(identity: BriefIdentity, briefs: BriefStore = getBriefStore()): Promise<StoredBrief[]> {
  return briefs.listForOwner(identity.tenantId, identity.uid);
}

export async function getDecisionBrief(identity: BriefIdentity, briefId: string, briefs: BriefStore = getBriefStore()): Promise<StoredBrief> {
  const brief = await briefs.get(identity.tenantId, briefId);
  if (!brief) throw new ApiError(404, 'Brief not found.');
  assertBriefOwner(identity, brief);
  return brief;
}

export async function reviewDecisionBrief(identity: BriefIdentity, briefId: string, briefs: BriefStore = getBriefStore()): Promise<StoredBrief> {
  const brief = await getDecisionBrief(identity, briefId, briefs);
  if (brief.reviewedByHuman) return brief;
  const reviewedAt = new Date().toISOString();
  const updated = await briefs.markReviewed(identity.tenantId, briefId, { reviewerUid: identity.uid, reviewedAt });
  if (!updated) throw new ApiError(404, 'Brief not found.');
  return updated;
}
