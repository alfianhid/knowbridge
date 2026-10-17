import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askWorkspace } from '../src/lib/workspace-query';
import { SyntheticSeedAdapter } from '../src/lib/sources';
import type { WorkspaceSource } from '../src/lib/workspace-store';

const identity = { uid: 'fictional-reader', tenantId: 'demo-north-quay' };
let imported: WorkspaceSource;
const vector = () => Array.from({ length: 768 }, (_, index) => index === 0 ? 1 : 0);

beforeEach(async () => {
  vi.stubEnv('KNOWBRIDGE_RETRIEVAL', 'local');
  vi.stubEnv('KNOWBRIDGE_STORE', 'file');
  const [source] = await new SyntheticSeedAdapter().list(['HBR-DOC-04']);
  imported = { source, rawExport: source.content, fileId: 'fictional-drive-id', modifiedTime: '2026-10-17T00:00:00Z',
    version: '1', importedAt: '2026-10-17T01:00:00Z', embeddings: source.chunks.map(vector) };
});
afterEach(() => vi.unstubAllEnvs());
function vertex() {
  vi.stubEnv('KNOWBRIDGE_RETRIEVAL', 'vertex'); vi.stubEnv('KNOWBRIDGE_STORE', 'firestore');
  vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'test-project'); vi.stubEnv('GOOGLE_CLOUD_LOCATION', 'global');
  vi.stubEnv('GOOGLE_GENAI_USE_VERTEXAI', 'true'); vi.stubEnv('GEMINI_MODEL', 'gemini-3-flash-preview');
  vi.stubEnv('EMBEDDING_MODEL', 'gemini-embedding-001'); vi.stubEnv('EMBEDDING_DIMENSIONS', '768');
}
const generated = () => ({ status: 'supported', claims: [{ claim: 'QA completion is forecast for 2026-11-11.',
  evidence: [{ sourceId: 'HBR-DOC-04', excerpt: 'The latest forecast for final regression completion is 2026-11-11.' }] }], unknowns: [] });

describe('selected Workspace query boundary', () => {
  it('keeps citations private, date provenance historical and local mode explicit', async () => {
    const authorized = vi.fn().mockResolvedValue([imported]);
    const result = await askWorkspace('What is the QA forecast?', identity, { authorized });
    expect(result.mode).toBe('local');
    expect(result.unknowns.join()).toContain('no AI synthesis');
    expect(result.claims[0].evidence[0].sourceUrl).toBe('/api/workspace/sources/HBR-DOC-04');
    expect(result.claims[0].evidence[0].recordedAt).toBe('2026-10-10');
    expect(authorized).toHaveBeenCalledTimes(2);
    expect(authorized).toHaveBeenCalledWith(identity);
  });
  it('abstains for no authorized files without embedding, generation or semantic review', async () => {
    vertex();
    const generate = vi.fn(), assess = vi.fn(), embedQuery = vi.fn();
    const result = await askWorkspace('What is the QA forecast?', identity, { authorized: async () => [], generate, assess, embedQuery });
    expect(result.status).toBe('insufficient_evidence');
    expect(generate).not.toHaveBeenCalled(); expect(assess).not.toHaveBeenCalled(); expect(embedQuery).not.toHaveBeenCalled();
  });
  it('never sends content to a model when owner authorization fails', async () => {
    vertex();
    const generate = vi.fn(), embedQuery = vi.fn();
    await expect(askWorkspace('What is the QA forecast?', identity, { authorized: async () => { throw new Error('Revoked'); }, generate, embedQuery })).rejects.toThrow('Revoked');
    expect(generate).not.toHaveBeenCalled(); expect(embedQuery).not.toHaveBeenCalled();
  });
  it('rejects a stale original before the query embedding or generation', async () => {
    vertex();
    const authorized = vi.fn().mockResolvedValueOnce([imported]).mockResolvedValue([{ ...imported, version: '2' }]);
    const generate = vi.fn(), embedQuery = vi.fn();
    await expect(askWorkspace('What is the QA forecast?', identity, { authorized, generate, embedQuery })).rejects.toThrow('sources changed');
    expect(generate).not.toHaveBeenCalled(); expect(embedQuery).not.toHaveBeenCalled();
  });
  it('validates exact excerpts and semantic verdicts with fresh permission checks', async () => {
    vertex();
    const authorized = vi.fn().mockResolvedValue([imported]);
    const assess = vi.fn().mockResolvedValue({ statements: [{ index: 0, categories: ['forecast'], verdict: 'supported', reason: 'Exact forecast excerpt.' }] });
    const result = await askWorkspace('What is the QA forecast?', identity,
      { authorized, embedQuery: async () => vector(), generate: async () => generated(), assess });
    expect(result.answer).toContain('2026-11-11');
    expect(result.claims[0].evidence[0].sourceUrl).toContain('/api/workspace/sources/');
    expect(authorized.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(assess).toHaveBeenCalledOnce();
  });
  it('rejects fabricated excerpts after two attempts without semantic review', async () => {
    vertex();
    const generate = vi.fn().mockResolvedValue({ status: 'supported', claims: [{ claim: 'Launch approved.',
      evidence: [{ sourceId: 'HBR-DOC-04', excerpt: 'Production launch is approved.' }] }], unknowns: [] });
    const assess = vi.fn();
    await expect(askWorkspace('What is the QA forecast?', identity,
      { authorized: async () => [imported], embedQuery: async () => vector(), generate, assess })).rejects.toThrow('failed evidence validation');
    expect(generate).toHaveBeenCalledTimes(2); expect(assess).not.toHaveBeenCalled();
  });
  it('withholds an answer when access disappears during semantic review', async () => {
    vertex();
    let revoked = false;
    const authorized = async () => { if (revoked) throw new Error('Provider access revoked'); return [imported]; };
    const assess = async () => { revoked = true; return { statements: [{ index: 0, categories: ['forecast'], verdict: 'supported', reason: 'Exact evidence.' }] }; };
    await expect(askWorkspace('What is the QA forecast?', identity,
      { authorized, embedQuery: async () => vector(), generate: async () => generated(), assess })).rejects.toThrow();
  });
});
