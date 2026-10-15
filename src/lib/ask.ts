import { ApiError, type AccessScope } from './access';
import { ModelAnswerSchema } from './ask-contracts';
import { EvidenceRefSchema } from './contracts';
import { assessSemantics, generateGrounded, getAIConfig } from './gemini';
import { DecisionCoverageError, requireDecisionCoverage, requireSupportedSemantics } from './decision-semantics';
import { checkRetrieved, evidencePassages, retrieveLocal, selectQuestionSources } from './retrieval';
import { getSourceStore } from './source-store';
import { DEMO_TENANT_ID, type IngestionStore, type SourceChunk, type SourceRecord } from './sources';
import { retrieveVectors } from './vector-retrieval';
import type { z } from 'zod';

type Evidence = z.infer<typeof EvidenceRefSchema>;
export interface AskResponse {
  status: 'supported' | 'insufficient_evidence';
  answer: string;
  claims: { claim: string; evidence: Evidence[] }[];
  unknowns: string[];
  mode: 'local' | 'vertex';
  model: string | null;
  synthetic: true;
}

export function retrievalMode(): 'local' | 'vertex' {
  const mode = process.env.KNOWBRIDGE_RETRIEVAL ?? (process.env.K_SERVICE ? 'vertex' : 'local');
  const storage = process.env.KNOWBRIDGE_STORE ?? (process.env.K_SERVICE ? 'firestore' : 'file');
  if ((mode !== 'local' && mode !== 'vertex') || (process.env.K_SERVICE && mode !== 'vertex')) {
    throw new ApiError(503, 'Cloud Run requires Vertex AI retrieval.');
  }
  if (!['file', 'firestore'].includes(storage) || (mode === 'vertex' && storage !== 'firestore')
    || (process.env.K_SERVICE && storage !== 'firestore')) {
    throw new ApiError(503, 'Vertex AI retrieval and Cloud Run require Firestore storage.');
  }
  return mode;
}

export function finalizeAnswer(input: unknown, sources: ReadonlyMap<string, SourceRecord>, chunks: SourceChunk[]): Pick<AskResponse, 'status' | 'answer' | 'claims' | 'unknowns'> {
  const parsed = ModelAnswerSchema.parse(input);
  const claims = parsed.claims.map(claim => ({ ...claim, evidence: claim.evidence.map(reference => {
    const source = sources.get(reference.sourceId);
    if (!source || !source.content.includes(reference.excerpt) || !chunks.some(chunk => chunk.sourceId === source.id && chunk.body.includes(reference.excerpt))) {
      throw new Error('Citation is not present in authorized retrieved evidence.');
    }
    return EvidenceRefSchema.parse({ ...reference, sourceTitle: source.title, sourceUrl: `/api/sources/${source.id}`, recordedAt: source.recordedAt, effectiveAt: source.effectiveAt });
  }) }));
  return { status: parsed.status, claims, unknowns: parsed.unknowns,
    answer: parsed.status === 'insufficient_evidence' ? 'Insufficient evidence.' : claims.map(claim => claim.claim).join('\n\n') };
}

interface AskDependencies {
  store?: IngestionStore;
  retrieve?: typeof retrieveVectors;
  generate?: typeof generateGrounded;
  assess?: typeof assessSemantics;
}

export async function askQuestion(question: string, tenantId: string, dependencies: AskDependencies = {}): Promise<AskResponse> {
  if (tenantId !== DEMO_TENANT_ID) throw new ApiError(403, 'Source access denied.');
  const mode = retrievalMode();
  if (mode === 'vertex') getAIConfig();
  const store = dependencies.store ?? getSourceStore();
  const available = (await store.list(tenantId)).filter(source => source.tenantId === tenantId && source.synthetic);
  const records = selectQuestionSources(question, available, { tenantId, sourceIds: new Set(available.map(source => source.id)) });
  const scope: AccessScope = { tenantId, sourceIds: new Set(records.map(source => source.id)) };
  const sources = new Map(records.map(source => [source.id, source]));
  const retrieved = records.length ? (mode === 'local' ? retrieveLocal(question, records, scope) : await (dependencies.retrieve ?? retrieveVectors)(question, scope)) : [];
  const chunks = checkRetrieved(retrieved, sources, scope);
  const metadata = { mode, model: mode === 'vertex' ? getAIConfig().model : null, synthetic: true as const };
  const abstain = () => ({ ...finalizeAnswer({ status: 'insufficient_evidence', claims: [], unknowns: ['No sufficient authorized evidence found for this question.'] }, sources, []), ...metadata });
  if (!chunks.length) return abstain();
  if (mode === 'local') {
    const claims = chunks.flatMap(chunk => evidencePassages(chunk.body).slice(0, 1).map(excerpt => ({ claim: excerpt, evidence: [{ sourceId: chunk.sourceId, excerpt }] })));
    if (!claims.length) return abstain();
    return { ...finalizeAnswer({ status: 'supported', claims, unknowns: ['Local deterministic evidence lookup; no AI synthesis or decision recommendation.'] }, sources, chunks), ...metadata };
  }
  let diagnostics: string | undefined;
  // Re-read originals before both synthesis and semantic review; changed sources fail closed.
  const refreshSources = async () => {
    const current = new Map<string, SourceRecord>();
    for (const sourceId of new Set(chunks.map(chunk => chunk.sourceId))) {
      const source = await store.get(tenantId, sourceId);
      if (source && source.tenantId === tenantId && scope.sourceIds.has(source.id)) current.set(sourceId, source);
    }
    checkRetrieved(chunks, current, scope);
    return current;
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await refreshSources();
    const generated = await (dependencies.generate ?? generateGrounded)(question, chunks, diagnostics);
    try {
      const answer = finalizeAnswer(generated, current, chunks);
      if (answer.status === 'insufficient_evidence') return abstain();
      if (answer.claims.length) {
        requireDecisionCoverage(question, answer.claims.map(claim => ({ text: claim.claim, evidence: claim.evidence })), [...current.values()], chunks);
        const statements = [
          ...answer.claims.map(claim => ({ text: claim.claim, evidence: claim.evidence })),
          ...answer.unknowns.map(text => ({ text, evidence: answer.claims.flatMap(claim => claim.evidence) })),
        ];
        await refreshSources();
        let assessment: unknown;
        try { assessment = await (dependencies.assess ?? assessSemantics)(statements, chunks); }
        catch { throw new ApiError(503, 'Semantic review is unavailable. Please retry.'); }
        requireSupportedSemantics(assessment, statements.length);
      }
      await refreshSources();
      return { ...answer, ...metadata };
    }
    catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DecisionCoverageError) { diagnostics = error.message; continue; }
      diagnostics = 'Response failed schema, literal citation or semantic evidence validation. Use only supplied source IDs and exact excerpts. Preserve client expectation, baseline, forecast, commitment and approval authority. Do not infer QA completion, launch impossibility, feasibility, approval or a signed revised commitment. Correct negative statements may be supported in context. Any evidence-backed claims require status supported, even for negative or pending findings; this status never means launch approval. For insufficient_evidence return claims:[] and at least one unknown. Do not combine abstention status with claims.';
    }
  }
  throw new ApiError(502, 'Generated answer failed evidence validation. Please retry.');
}
