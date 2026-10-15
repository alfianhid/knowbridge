import { beforeEach, describe, expect, it, vi } from 'vitest';
import { indexVectors, retrieveVectors } from '../src/lib/vector-retrieval';
import { DEMO_TENANT_ID, loadSyntheticSources } from '../src/lib/sources';

const mock = vi.hoisted(() => ({ collection: vi.fn(), where: vi.fn(), findNearest: vi.fn(), get: vi.fn(), sourceGet: vi.fn(), doc: vi.fn(), embed: vi.fn() }));
vi.mock('../src/lib/firebase', () => ({ getDatabase: () => ({ collection: mock.collection, doc: mock.doc }) }));
vi.mock('../src/lib/gemini', () => ({ embed: mock.embed,
  getAIConfig: () => ({ embeddingModel: 'gemini-embedding-001' }), validateEmbedding: (value: number[]) => value }));
vi.mock('../src/lib/source-store', () => ({ getSourceStore: () => ({ get: mock.sourceGet }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mock.embed.mockResolvedValue(Array(768).fill(1));
  mock.collection.mockReturnValue({ where: mock.where });
  mock.where.mockReturnValue({ findNearest: mock.findNearest });
  mock.findNearest.mockReturnValue({ get: mock.get });
});

describe('scoped Firestore vector retrieval', () => {
  it('reuses persisted embedding cache when a vector write is retried', async () => {
    const source = (await loadSyntheticSources()).find(item => item.id === 'HBR-DOC-04')!;
    const values = new Map<string, unknown>();
    let failWrite = true;
    mock.doc.mockImplementation((path: string) => ({
      get: async () => ({ exists: values.has(path), data: () => values.get(path) }),
      set: async (data: unknown) => {
        if (path.includes('/chunks/') && failWrite) { failWrite = false; throw new Error('transient'); }
        values.set(path, data);
      },
    }));
    const store = { list: async () => [source], get: vi.fn(), upsert: vi.fn(), consumeIngestionQuota: vi.fn() };
    await expect(indexVectors(store)).rejects.toThrow('transient');
    expect(mock.embed).toHaveBeenCalledTimes(1);
    const result = await indexVectors(store);
    expect(result.cached).toBe(1);
    expect(mock.embed).toHaveBeenCalledTimes(source.chunks.length);
  });
  it('applies tenant path and source filter before nearest search', async () => {
    mock.get.mockResolvedValue({ docs: [] });
    const ids = Array.from({ length: 31 }, (_, i) => `SRC-${i}`);
    await retrieveVectors('question', { tenantId: DEMO_TENANT_ID, sourceIds: new Set(ids) });
    expect(mock.collection).toHaveBeenCalledWith(`tenants/${DEMO_TENANT_ID}/chunks`);
    expect(mock.where.mock.calls).toEqual([['sourceId', 'in', ids.slice(0, 30)], ['sourceId', 'in', ids.slice(30)]]);
    expect(mock.findNearest).toHaveBeenCalledTimes(2);
  });
  it('rejects cross-tenant vectors before source lookup', async () => {
    mock.get.mockResolvedValue({ docs: [{ id: 'HBR-DOC-04:0', data: () => ({ tenantId: 'other', sourceId: 'HBR-DOC-04' }) }] });
    await expect(retrieveVectors('question', { tenantId: DEMO_TENANT_ID, sourceIds: new Set(['HBR-DOC-04']) })).rejects.toThrow('scope');
    expect(mock.sourceGet).not.toHaveBeenCalled();
  });
  it('excludes stale hashes and tampered chunks, returns fresh original', async () => {
    const source = (await loadSyntheticSources()).find(item => item.id === 'HBR-DOC-04')!;
    const chunk = source.chunks[0];
    const base = { ...chunk, contentHash: source.contentHash, embeddingModel: 'gemini-embedding-001', embeddingDimensions: 768, vectorDistance: 0.1 };
    mock.sourceGet.mockResolvedValue(source);
    const scope = { tenantId: DEMO_TENANT_ID, sourceIds: new Set([source.id]) };
    for (const data of [{ ...base, contentHash: 'stale' }, { ...base, body: 'tampered' }]) {
      mock.get.mockResolvedValue({ docs: [{ id: chunk.id, data: () => data }] });
      expect(await retrieveVectors('question', scope)).toEqual([]);
    }
    mock.get.mockResolvedValue({ docs: [{ id: chunk.id, data: () => base }] });
    expect(await retrieveVectors('question', scope)).toEqual([chunk]);
  });
});
