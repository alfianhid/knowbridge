import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryIngestionStore, ingestSyntheticSources } from '../src/lib/sources';

const mocks = vi.hoisted(() => ({ store: null as InMemoryIngestionStore | null, admin: vi.fn() }));
vi.mock('../src/lib/source-store', () => ({ getSourceStore: () => mocks.store }));
vi.mock('../src/lib/access', async (original) => ({ ...await original<object>(), requireIngestionAdmin: mocks.admin }));
beforeEach(async () => {
  mocks.store = new InMemoryIngestionStore();
  await ingestSyntheticSources({ store: mocks.store });
  mocks.admin.mockImplementation(async (request: Request) => {
    const { ApiError } = await import('../src/lib/access');
    if (!request.headers.get('authorization')) throw new ApiError(401, 'Valid admin authentication required.');
    return 'verified-admin';
  });
});
import { GET as listSources } from '../src/app/api/sources/route';
import { GET as getSource } from '../src/app/api/sources/[sourceId]/route';
import { POST as ingestSources } from '../src/app/api/ingest/route';

describe('sources API', () => {
  it('returns only bounded public metadata from GET /api/sources', async () => {
    const response = await listSources(new Request('http://localhost/api/sources'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.synthetic).toBe(true);
    expect(body.items).toHaveLength(18);
    expect(body.items[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      title: expect.any(String),
      kind: expect.stringMatching(/^google_(doc|sheet)$/),
      project: expect.any(String),
      recordedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      sourceUrl: expect.stringMatching(/^\/api\/sources\//),
      chunkCount: expect.any(Number),
    }));
    expect(body.items[0]).not.toHaveProperty('content');
    expect(body.items[0]).not.toHaveProperty('file');
    expect(body.items[0]).not.toHaveProperty('tenantId');
  });

  it('rejects a different tenant without disclosing sources', async () => {
    const request = new Request('http://localhost/api/sources', {
      headers: { 'x-knowbridge-tenant': 'other-tenant' },
    });
    const response = await listSources(request);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Source access denied.' });
  });

  it('returns literal source details and handles missing IDs', async () => {
    const found = await getSource(
      new Request('http://localhost/api/sources/HBR-DOC-02'),
      { params: Promise.resolve({ sourceId: 'HBR-DOC-02' }) },
    );
    const detail = await found.json();
    expect(found.status).toBe(200);
    expect(detail.id).toBe('HBR-DOC-02');
    expect(detail.content).toContain('2026-11-01');
    expect(detail.synthetic).toBe(true);
    expect(detail).not.toHaveProperty('chunks');
    expect(detail).not.toHaveProperty('tenantId');

    const missing = await getSource(
      new Request('http://localhost/api/sources/MISSING'),
      { params: Promise.resolve({ sourceId: 'MISSING' }) },
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'Source not found.' });
  });

  it('protects POST /api/ingest and rejects arbitrary input modes', async () => {
      const unauthorized = await ingestSources(new Request('http://localhost/api/ingest', {
        method: 'POST',
        body: JSON.stringify({ mode: 'synthetic' }),
      }));
      expect(unauthorized.status).toBe(401);

      const invalid = await ingestSources(new Request('http://localhost/api/ingest', {
        method: 'POST',
        headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'drive', sourceIds: ['../../README.md'] }),
      }));
      expect(invalid.status).toBe(400);

      const duplicate = await ingestSources(new Request('http://localhost/api/ingest', {
        method: 'POST',
        headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'synthetic', sourceIds: ['HBR-DOC-02', 'HBR-DOC-02'] }),
      }));
      expect(duplicate.status).toBe(400);

      const accepted = await ingestSources(new Request('http://localhost/api/ingest', {
        method: 'POST',
        headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'synthetic', sourceIds: ['HBR-DOC-02'] }),
      }));
      expect(accepted.status).toBe(200);
      expect(await accepted.json()).toEqual(expect.objectContaining({
        queued: 1,
        failed: 0,
      }));
  });

  it('returns 404 for unauthorized detail access and never exposes private content', async () => {
    const response = await getSource(new Request('http://localhost/api/sources/HBR-DOC-02', {
      headers: { 'x-knowbridge-tenant': 'other-tenant' },
    }), { params: Promise.resolve({ sourceId: 'HBR-DOC-02' }) });
    expect(response.status).toBe(404);
  });

  it('caps actual body bytes without Content-Length', async () => {
    const response = await ingestSources(new Request('http://localhost/api/ingest', {
      method: 'POST', headers: { authorization: 'Bearer verified', 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'synthetic', extra: 'x'.repeat(17000) }),
    }));
    expect(response.status).toBe(413);
  });
});
