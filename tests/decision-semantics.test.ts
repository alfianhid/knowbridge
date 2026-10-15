import { describe, expect, it, vi, afterEach } from 'vitest';
import { decisionFacts, requireDecisionCoverage, requireSupportedSemantics, type SemanticStatement } from '../src/lib/decision-semantics';
import { askQuestion } from '../src/lib/ask';
import { finalizeVerifiedDecisionBrief } from '../src/lib/verified-brief';
import { DEMO_TENANT_ID, InMemoryIngestionStore, ingestSyntheticSources } from '../src/lib/sources';

afterEach(() => vi.unstubAllEnvs());
const verdict = (verdict: string) => ({ statements: [{ index: 0, categories: ['forecast'], verdict, reason: 'Source-linked assessment.' }] });

describe('semantic evidence gate', () => {
  it('never requires or leaks operative facts outside selected chunks', async () => {
    const store = new InMemoryIngestionStore();
    await ingestSyntheticSources({ store });
    const source = (await store.list(DEMO_TENANT_ID)).find(source => source.id === 'HBR-DOC-04')!;
    const headerOnly = { ...source.chunks[0], body: source.content.split('\n\n')[0] };
    expect(decisionFacts([source])).toEqual([expect.objectContaining({ value: '2026-11-11' })]);
    expect(decisionFacts([source], [headerOnly])).toEqual([]);
    expect(() => requireDecisionCoverage('Can Harbour launch?', [{ text: 'The selected QA excerpt contains no operative forecast.',
      evidence: [{ sourceId: source.id, excerpt: headerOnly.body }] }], [source], [headerOnly])).not.toThrow();
  });
  it('preserves typed client target, QA forecast, pending approval and recorded dates', async () => {
    const store = new InMemoryIngestionStore();
    await ingestSyntheticSources({ store });
    const facts = decisionFacts(await store.list(DEMO_TENANT_ID));
    expect(facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'client_expectation', value: '2026-11-01', sourceId: 'HBR-DOC-02' }),
      expect.objectContaining({ category: 'forecast', value: '2026-11-11', sourceId: 'HBR-DOC-04', recordedAt: '2026-10-10', effectiveAt: null }),
      expect.objectContaining({ category: 'approval', value: 'PENDING', sourceId: 'HBR-DOC-06' }),
    ]));
  });
  it('rejects omitted owning citations and date values even when dates appear in excerpts', async () => {
    const store = new InMemoryIngestionStore();
    await ingestSyntheticSources({ store });
    const sources = await store.list(DEMO_TENANT_ID);
    const evidence = ['02', '04', '05', '06', '09'].map(id => ({ sourceId: `HBR-DOC-${id}`, excerpt: 'Literal excerpt validated before this coverage gate.' }));
    const complete = [{ text: 'Target 2026-11-01; QA forecast 2026-11-11; security PENDING. Seek approvals before committing.', evidence }];
    expect(() => requireDecisionCoverage('Can Harbour launch?', complete, sources)).not.toThrow();
    expect(() => requireDecisionCoverage('Can Harbour launch?', [{ ...complete[0], evidence: evidence.filter(ref => ref.sourceId !== 'HBR-DOC-05') }], sources)).toThrow('owning-record');
    expect(() => requireDecisionCoverage('Can Harbour launch?', [{ ...complete[0], text: 'Target 2026-11-01, QA later; security pending.' }], sources)).toThrow('forecast=2026-11-11');
  });
  it('allows contextual negative acceptance claims with all owning authority records', async () => {
    const store = new InMemoryIngestionStore();
    await ingestSyntheticSources({ store });
    const sources = await store.list(DEMO_TENANT_ID);
    const statements = [{ text: 'No signed revised commitment is evidenced; no accepted pilot is recorded.',
      evidence: ['02', '09', '15'].map(id => ({ sourceId: `HBR-DOC-${id}`, excerpt: 'Literal evidence is checked separately.' })) }];
    expect(() => requireDecisionCoverage('Has the client signed the revised Harbour launch commitment?', statements, sources)).not.toThrow();
  });
  it('does not send removed evidence to semantic review after synthesis', async () => {
    for (const [key, value] of Object.entries({ KNOWBRIDGE_STORE: 'firestore', KNOWBRIDGE_RETRIEVAL: 'vertex', GOOGLE_CLOUD_PROJECT: 'test-project',
      GOOGLE_CLOUD_LOCATION: 'global', GOOGLE_GENAI_USE_VERTEXAI: 'true', GEMINI_MODEL: 'gemini-3.8-flash', EMBEDDING_MODEL: 'gemini-embedding-001', EMBEDDING_DIMENSIONS: '768' })) vi.stubEnv(key, value);
    const store = new InMemoryIngestionStore();
    await ingestSyntheticSources({ store });
    const source = (await store.list(DEMO_TENANT_ID)).find(source => source.id === 'HBR-DOC-04')!;
    vi.spyOn(store, 'get').mockResolvedValueOnce(source).mockResolvedValue(null);
    const assess = vi.fn();
    await expect(askQuestion('QA forecast?', DEMO_TENANT_ID, { store, retrieve: async () => source.chunks, assess,
      generate: async () => ({ status: 'supported', claims: [{ claim: 'QA forecasts completion on 2026-11-11.',
        evidence: [{ sourceId: source.id, excerpt: 'The latest forecast for final regression completion is 2026-11-11.' }] }], unknowns: [] })
    })).rejects.toMatchObject({ status: 502 });
    expect(assess).not.toHaveBeenCalled();
  });
  it('replaces ungrounded model abstention text with server-owned wording', async () => {
    for (const [key, value] of Object.entries({ KNOWBRIDGE_STORE: 'firestore', KNOWBRIDGE_RETRIEVAL: 'vertex', GOOGLE_CLOUD_PROJECT: 'test-project',
      GOOGLE_CLOUD_LOCATION: 'global', GOOGLE_GENAI_USE_VERTEXAI: 'true', GEMINI_MODEL: 'gemini-3.8-flash', EMBEDDING_MODEL: 'gemini-embedding-001', EMBEDDING_DIMENSIONS: '768' })) vi.stubEnv(key, value);
    const store = new InMemoryIngestionStore();
    await ingestSyntheticSources({ store });
    const source = (await store.list(DEMO_TENANT_ID))[0];
    const result = await askQuestion('Can Harbour launch?', DEMO_TENANT_ID, { store, retrieve: async () => source.chunks,
      generate: async () => ({ status: 'insufficient_evidence', claims: [], unknowns: ['Security approval was granted.'] }) });
    expect(result.status).toBe('insufficient_evidence');
    expect(result.unknowns.join()).not.toContain('approval was granted');
  });
  it('rejects omitted, duplicate, out-of-range and uncertain assessments', () => {
    for (const result of [verdict('contradicted'), verdict('insufficient_evidence'), { statements: [] },
      { statements: [verdict('supported').statements[0], verdict('supported').statements[0]] },
      { statements: [{ ...verdict('supported').statements[0], index: 1 }] }]) {
      expect(() => requireSupportedSemantics(result, 1)).toThrow();
    }
    expect(() => requireSupportedSemantics(verdict('supported'), 1)).not.toThrow();
  });

  it.each(['Full launch is definitely impossible.', 'The customer never expected 2026-11-01.', 'QA is complete.',
    'Security approved production.', 'The client signed the revised commitment.'])('fails closed on a rejected interpretation: %s', async claim => {
    for (const [key, value] of Object.entries({ KNOWBRIDGE_STORE: 'firestore', KNOWBRIDGE_RETRIEVAL: 'vertex', GOOGLE_CLOUD_PROJECT: 'test-project',
      GOOGLE_CLOUD_LOCATION: 'global', GOOGLE_GENAI_USE_VERTEXAI: 'true', GEMINI_MODEL: 'gemini-3.8-flash', EMBEDDING_MODEL: 'gemini-embedding-001', EMBEDDING_DIMENSIONS: '768' })) vi.stubEnv(key, value);
    const store = new InMemoryIngestionStore();
    await ingestSyntheticSources({ store });
    const source = (await store.list(DEMO_TENANT_ID)).find(source => source.id === 'HBR-DOC-04')!;
    const generate = vi.fn().mockResolvedValue({ status: 'supported', claims: [{ claim, evidence: [{ sourceId: source.id,
      excerpt: 'The latest forecast for final regression completion is 2026-11-11.' }] }], unknowns: [] });
    const assess = vi.fn().mockResolvedValue(verdict('contradicted'));
    await expect(askQuestion('What conclusions does the QA forecast support?', DEMO_TENANT_ID, { store, retrieve: async () => source.chunks, generate, assess })).rejects.toMatchObject({ status: 502 });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(assess).toHaveBeenCalledTimes(2);
    expect(assess.mock.calls[0][1]).toEqual(source.chunks);
  });

  it('checks brief recommendation as well as claims and discards model review flags', async () => {
    const store = new InMemoryIngestionStore();
    await ingestSyntheticSources({ store });
    const source = (await store.list(DEMO_TENANT_ID)).find(source => source.id === 'HBR-DOC-09')!;
    const input = { question: 'Has the client signed a new commitment?', status: 'at_risk', recommendation: 'Seek customer approval before a revised commitment.',
      supportingClaims: [{ claim: 'No signed commitment is evidenced.', evidence: [{ sourceId: source.id, excerpt: 'No decision authorizing a later full-release date exists in this log.' }] }],
      conflicts: [], alternatives: [], unknowns: ['Customer approval remains unverified.'], suggestedNextStep: 'Ask the owner to obtain written customer approval.', reviewedByHuman: true };
    const assess = vi.fn(async (statements: SemanticStatement[]) => ({ statements: statements.map((_, index) => ({ index, categories: ['commitment'], verdict: 'supported', reason: 'No revised commitment authorized.' })) }));
    const result = await finalizeVerifiedDecisionBrief(input, new Map([[source.id, source]]), assess);
    expect(result.reviewedByHuman).toBe(false);
    expect(result.supportingClaims[0].claim).toContain('No signed commitment');
    expect(assess.mock.calls[0][0].map(item => item.text)).toContain(input.recommendation);
    await expect(finalizeVerifiedDecisionBrief({ ...input, recommendation: 'Full launch is definitely impossible.' }, new Map([[source.id, source]]),
      async () => ({ statements: [] }))).rejects.toThrow('semantic');
  });
});
