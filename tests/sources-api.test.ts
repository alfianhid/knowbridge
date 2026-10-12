import { describe, expect, it } from 'vitest';
import { GET as listSources } from '../src/app/api/sources/route';
import { GET as getSource } from '../src/app/api/sources/[sourceId]/route';

describe('sources API', () => {
  it('returns only bounded public metadata from GET /api/sources', async () => {
    const response = await listSources(new Request('http://localhost/api/sources'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.synthetic).toBe(true);
    expect(body.items).toHaveLength(27);
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

    const missing = await getSource(
      new Request('http://localhost/api/sources/MISSING'),
      { params: Promise.resolve({ sourceId: 'MISSING' }) },
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'Source not found.' });
  });
});
