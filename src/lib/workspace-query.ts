import { ApiError, type BriefIdentity } from './access';
import { finalizeAnswer, retrievalMode, type AskResponse } from './ask';
import { assessSemantics, embed, generateGrounded, getAIConfig, validateEmbedding } from './gemini';
import { requireDecisionCoverage, requireSupportedSemantics } from './decision-semantics';
import { evidencePassages, retrieveLocal, selectQuestionSources } from './retrieval';
import { DEMO_TENANT_ID, type SourceChunk } from './sources';
import { authorizedWorkspaceSources, type WorkspaceSource } from './workspace-import';

export interface WorkspaceQueryDependencies {
  authorized?: (identity: BriefIdentity) => Promise<WorkspaceSource[]>;
  embedQuery?: (question: string) => Promise<number[]>;
  generate?: typeof generateGrounded;
  assess?: typeof assessSemantics;
}

function snapshot(sources: WorkspaceSource[]): string {
  return JSON.stringify(sources.map(item => [item.fileId, item.version, item.modifiedTime, item.importedAt, item.source.id,
    item.source.contentHash, item.source.chunks.map(chunk => chunk.checksum)]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

function similarity(left: number[], right: number[]): number {
  const product = left.reduce((sum, value, index) => sum + value * right[index], 0);
  const magnitude = Math.hypot(...left) * Math.hypot(...right);
  return magnitude ? product / magnitude : 0;
}

// No public-source store or public vector index is queried by this path.
export async function askWorkspace(question: string, identity: BriefIdentity,
  dependencies: WorkspaceQueryDependencies = {}): Promise<AskResponse> {
  const authorize = dependencies.authorized ?? authorizedWorkspaceSources;
  const mode = retrievalMode();
  const imported = await authorize(identity);
  const initial = snapshot(imported);
  const refresh = async () => {
    const current = await authorize(identity);
    if (snapshot(current) !== initial) throw new ApiError(409, 'Workspace sources changed. Refresh imports before retrying.');
  };
  const available = imported.map(item => item.source);
  const records = selectQuestionSources(question, available, { tenantId: DEMO_TENANT_ID, sourceIds: new Set(available.map(item => item.id)) });
  const sourceMap = new Map(records.map(source => [source.id, source]));
  const scope = { tenantId: DEMO_TENANT_ID, sourceIds: new Set(sourceMap.keys()) };
  const metadata = { mode, model: mode === 'vertex' ? getAIConfig().model : null, synthetic: true as const };
  const abstain = (): AskResponse => ({ status: 'insufficient_evidence', answer: 'Insufficient evidence.', claims: [],
    unknowns: ['No sufficient authorized evidence found in the selected fictional Workspace files.'], ...metadata });
  if (!records.length) { await refresh(); return abstain(); }
  let chunks: SourceChunk[];
  if (mode === 'local') {
    chunks = retrieveLocal(question, records, scope);
  } else {
    await refresh();
    const query = validateEmbedding(await (dependencies.embedQuery ?? defaultQueryEmbedding(identity))(question));
    const ranked = imported.filter(item => scope.sourceIds.has(item.source.id)).flatMap(item => {
      if (item.embeddings.length !== item.source.chunks.length) throw new ApiError(503, 'Workspace index is incomplete. Reimport the file.');
      return item.source.chunks.map((chunk, index) => ({ chunk, score: similarity(query, validateEmbedding(item.embeddings[index])) }));
    });
    chunks = ranked.sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id)).slice(0, 8).map(item => item.chunk);
  }
  if (!chunks.length) { await refresh(); return abstain(); }
  const privateLinks = (answer: AskResponse): AskResponse => ({ ...answer, claims: answer.claims.map(claim => ({ ...claim,
    evidence: claim.evidence.map(reference => ({ ...reference, sourceUrl: `/api/workspace/sources/${reference.sourceId}` })),
  })) });
  if (mode === 'local') {
    const claims = chunks.flatMap(chunk => evidencePassages(chunk.body).slice(0, 1).map(excerpt => ({ claim: excerpt,
      evidence: [{ sourceId: chunk.sourceId, excerpt }] })));
    await refresh();
    if (!claims.length) return abstain();
    return privateLinks({ ...finalizeAnswer({ status: 'supported', claims,
      unknowns: ['Local deterministic Workspace lookup; no AI synthesis or decision recommendation.'] }, sourceMap, chunks), ...metadata });
  }
  let diagnostics: string | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await refresh();
    let generated: unknown;
    try { generated = await (dependencies.generate ?? generateGrounded)(question, chunks, diagnostics); }
    catch { throw new ApiError(503, 'Workspace generation unavailable. Please retry.'); }
    try {
      const answer = finalizeAnswer(generated, sourceMap, chunks);
      await refresh();
      if (answer.status === 'insufficient_evidence') return abstain();
      requireDecisionCoverage(question, answer.claims.map(claim => ({ text: claim.claim, evidence: claim.evidence })), records, chunks);
      const statements = [...answer.claims.map(claim => ({ text: claim.claim, evidence: claim.evidence })),
        ...answer.unknowns.map(text => ({ text, evidence: answer.claims.flatMap(claim => claim.evidence) }))];
      let assessment: unknown;
      try { assessment = await (dependencies.assess ?? assessSemantics)(statements, chunks); }
      catch { throw new ApiError(503, 'Workspace semantic review unavailable. Please retry.'); }
      requireSupportedSemantics(assessment, statements.length);
      await refresh();
      return privateLinks({ ...answer, ...metadata });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      diagnostics = 'Use only selected source IDs and literal retrieved excerpts. Preserve forecast, expectation, commitment and approval distinctions. Unsupported evidence must abstain.';
    }
  }
  throw new ApiError(502, 'Workspace answer failed evidence validation. Please retry.');
}

function defaultQueryEmbedding(identity: BriefIdentity): (question: string) => Promise<number[]> {
  return async question => {
    const { getWorkspaceStore } = await import('./workspace-store');
    const retryAt = await getWorkspaceStore().reserveEmbedding(identity, Date.now());
    if (retryAt !== null) throw new ApiError(429, `Embedding quota is paced. Retry after ${new Date(retryAt).toISOString()}.`);
    return embed(question, 'RETRIEVAL_QUERY');
  };
}
