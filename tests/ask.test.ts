import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askQuestion, finalizeAnswer } from '../src/lib/ask';
import { DEMO_TENANT_ID, InMemoryIngestionStore, ingestSyntheticSources, loadSyntheticSources } from '../src/lib/sources';
import { checkRetrieved, retrieveLocal } from '../src/lib/retrieval';

let store: InMemoryIngestionStore;
beforeEach(async () => {
  vi.stubEnv('KNOWBRIDGE_RETRIEVAL', 'local');
  store = new InMemoryIngestionStore();
  await ingestSyntheticSources({ store });
});
afterEach(() => vi.unstubAllEnvs());
function vertex() {
  vi.stubEnv('KNOWBRIDGE_RETRIEVAL', 'vertex');
  vi.stubEnv('KNOWBRIDGE_STORE', 'firestore');
  vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'test-project');
  vi.stubEnv('GOOGLE_CLOUD_LOCATION', 'global');
  vi.stubEnv('GEMINI_MODEL', 'gemini-3-flash-preview');
  vi.stubEnv('GOOGLE_GENAI_USE_VERTEXAI', 'true');
  vi.stubEnv('EMBEDDING_MODEL', 'gemini-embedding-001');
  vi.stubEnv('EMBEDDING_DIMENSIONS', '768');
}

describe('authorized grounded search', () => {
  it('retrieves exact Harbour facts with literal provenance and local disclosure', async () => {
    const result = await askQuestion('Can Project Harbour launch on 1 Nov?', DEMO_TENANT_ID, { store });
    expect(result.mode).toBe('local');
    expect(result.model).toBeNull();
    for (const id of ['HBR-DOC-02', 'HBR-DOC-04', 'HBR-DOC-06', 'HBR-DOC-09']) {
      expect(result.claims.flatMap(claim => claim.evidence).map(e => e.sourceId)).toContain(id);
    }
    expect(result.answer).toContain('2026-11-01');
    expect(result.answer).toContain('2026-11-11');
    expect(result.answer).toContain('PENDING');
    expect(result.answer).toContain('No decision authorizing a later full-release date');
    expect(result.claims.flatMap(claim => claim.evidence).find(e => e.sourceId === 'HBR-DOC-04')?.recordedAt).toBe('2026-10-10');
    expect(result.unknowns.join()).toContain('no AI synthesis');
  });
  it('abstains on absent personal data and empty storage without calling a model', async () => {
    const generate = vi.fn();
    expect((await askQuestion('What is Avery Tan personal mobile number?', DEMO_TENANT_ID, { store, generate })).status).toBe('insufficient_evidence');
    expect((await askQuestion('Can Harbour launch?', DEMO_TENANT_ID, { store: new InMemoryIngestionStore(), generate })).claims).toEqual([]);
    expect(generate).not.toHaveBeenCalled();
  });
  it.each(['Can NASA launch a lunar rocket?', 'Can Project Meridian launch on 1 Nov?', 'When will SpaceX release a new rocket?'])('abstains on unrelated launch subject: %s', async question => {
    expect((await askQuestion(question, DEMO_TENANT_ID, { store })).status).toBe('insufficient_evidence');
  });
  it('fails closed across tenants and source allowlists before generation', async () => {
    const generate = vi.fn();
    await expect(askQuestion('Can Harbour launch?', 'private-tenant', { store, generate })).rejects.toThrow('Source access denied');
    const sources = await loadSyntheticSources();
    const scope = { tenantId: DEMO_TENANT_ID, sourceIds: new Set(['HBR-DOC-02']) };
    expect(retrieveLocal('Can Harbour launch?', sources, scope).every(chunk => chunk.sourceId === 'HBR-DOC-02')).toBe(true);
    expect(() => checkRetrieved([sources[0].chunks[0]], new Map(), { ...scope, sourceIds: new Set() })).toThrow('Source access denied');
    expect(generate).not.toHaveBeenCalled();
  });
  it('rejects invented IDs, fabricated excerpts and citations outside retrieved context', async () => {
    const source = (await loadSyntheticSources())[0];
    const sources = new Map([[source.id, source]]);
    const make = (sourceId: string, excerpt: string) => ({ status: 'supported', claims: [{ claim: 'A claim', evidence: [{ sourceId, excerpt }] }], unknowns: [] });
    expect(() => finalizeAnswer(make('FAKE-ID', source.content.slice(0, 50)), sources, source.chunks)).toThrow();
    expect(() => finalizeAnswer(make(source.id, 'Customer approved full production launch.'), sources, source.chunks)).toThrow();
    expect(() => finalizeAnswer(make(source.id, source.content.slice(0, 50)), sources, [])).toThrow();
    expect(() => finalizeAnswer({ status: 'supported', claims: [], unknowns: [] }, sources, [])).toThrow();
  });
  it('retries invalid generation once and emits only validated claims', async () => {
    vertex();
    const source = (await store.list(DEMO_TENANT_ID)).find(source => source.id === 'HBR-DOC-04')!;
    const excerpt = 'The latest forecast for final regression completion is 2026-11-11.';
    const generate = vi.fn().mockResolvedValueOnce({ status: 'supported', claims: [], unknowns: [] }).mockResolvedValueOnce({ status: 'supported', claims: [{ claim: 'QA forecasts completion on 2026-11-11; this does not revise the customer commitment.', evidence: [{ sourceId: source.id, excerpt }] }], unknowns: [] });
    const assess = vi.fn().mockResolvedValue({ statements: [{ index: 0, categories: ['forecast'], verdict: 'supported', reason: 'Exact forecast; no revised commitment inferred.' }] });
    const result = await askQuestion('What is latest QA forecast?', DEMO_TENANT_ID, { store, retrieve: async () => source.chunks, generate, assess });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.answer).toContain('does not revise the customer commitment');
    expect(result.claims[0].evidence[0].sourceTitle).toBe(source.title);
  });
  it('returns controlled failure after two fabricated responses', async () => {
    vertex();
    const source = (await store.list(DEMO_TENANT_ID))[0];
    const generate = vi.fn().mockResolvedValue({ status: 'supported', claims: [{ claim: 'Approved.', evidence: [{ sourceId: 'FAKE', excerpt: 'Approval invented.' }] }], unknowns: [] });
    await expect(askQuestion('Can Harbour launch?', DEMO_TENANT_ID, { store, retrieve: async () => source.chunks, generate })).rejects.toThrow('failed evidence validation');
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it('does not send missing or changed original sources to Gemini', async () => {
    vertex();
    const source = (await store.list(DEMO_TENANT_ID))[0];
    const generate = vi.fn();
    vi.spyOn(store, 'get').mockResolvedValue(null);
    await expect(askQuestion('Can Harbour launch?', DEMO_TENANT_ID, { store, retrieve: async () => source.chunks, generate })).rejects.toThrow('missing or stale');
    expect(generate).not.toHaveBeenCalled();
  });
  it('refuses local retrieval on Cloud Run', async () => {
    vi.stubEnv('K_SERVICE', 'knowbridge');
    await expect(askQuestion('Can Harbour launch?', DEMO_TENANT_ID, { store })).rejects.toThrow('Cloud Run requires');
  });
});
