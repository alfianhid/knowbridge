import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEMO_TENANT_ID,
  getSourceForTenant,
  ingestSyntheticSources,
  InMemoryIngestionStore,
  listSourcesForTenant,
  loadSyntheticSources,
} from '../src/lib/sources';

const storage = vi.hoisted(() => ({ current: null as InMemoryIngestionStore | null }));
vi.mock('../src/lib/source-store', () => ({ getSourceStore: () => storage.current }));
beforeEach(async () => {
  storage.current = new InMemoryIngestionStore();
  await ingestSyntheticSources({ store: storage.current });
});

describe('synthetic source import', () => {
  it('loads the 16 Harbour docs and 2 Harbour sheets deterministically', async () => {
    const first = await loadSyntheticSources();
    const second = await loadSyntheticSources();

    expect(first).toHaveLength(18);
    expect(first.filter((source) => source.kind === 'google_doc')).toHaveLength(16);
    expect(first.filter((source) => source.kind === 'google_sheet')).toHaveLength(2);
    expect(first.every((source) => source.projectId === 'HBR')).toBe(true);
    expect(first.map(({ id, contentHash }) => ({ id, contentHash }))).toEqual(
      second.map(({ id, contentHash }) => ({ id, contentHash })),
    );
    expect(first.every((source) => source.tenantId === DEMO_TENANT_ID)).toBe(true);
    expect(first.every((source) => source.synthetic)).toBe(true);
    expect(first.every((source) => source.effectiveAt === null)).toBe(true);
    expect(first.every((source) => source.chunks.length === source.chunkCount)).toBe(true);
    expect(first.flatMap((source) => source.chunks).every((chunk) => (
      chunk.id === `${chunk.sourceId}:${chunk.ordinal}`
      && chunk.checksum.startsWith('sha256:')
      && chunk.tenantId === DEMO_TENANT_ID
    ))).toBe(true);
    const knownChunk = first.find((source) => source.id === 'HBR-DOC-02')?.chunks[0];
    expect(knownChunk).toEqual(expect.objectContaining({
      title: expect.stringContaining('Customer Commitments'),
      recordedAt: '2026-10-07',
      effectiveAt: null,
      projectId: 'HBR',
      ordinal: 0,
    }));
    expect(knownChunk?.checksum).toBe(
      `sha256:${createHash('sha256').update(knownChunk?.body ?? '').digest('hex')}`,
    );
  });

  it('keeps source IDs stable and converts sheet rows into readable text', async () => {
    const sources = await loadSyntheticSources();
    const harbour = sources.find((source) => source.id === 'HBR-DOC-02');
    const sheet = sources.find((source) => source.kind === 'google_sheet');

    expect(harbour?.content).toContain('2026-11-01');
    expect(harbour?.sourceUrl).toBe('/api/sources/HBR-DOC-02');
    expect(sheet?.content).toContain(': ');
    expect(sheet?.content).toContain('\n');
  });
});

describe('source authorization', () => {
  it('lists sources only for the isolated demo tenant', async () => {
    await expect(listSourcesForTenant(DEMO_TENANT_ID)).resolves.toHaveLength(18);
    await expect(listSourcesForTenant('other-tenant')).resolves.toEqual([]);
  });

  it('returns the same result for missing and unauthorized source lookups', async () => {
    await expect(getSourceForTenant(DEMO_TENANT_ID, 'MISSING')).resolves.toBeNull();
    await expect(getSourceForTenant('other-tenant', 'HBR-DOC-02')).resolves.toBeNull();
  });
});

describe('synthetic ingestion', () => {
  it('skips unchanged source hashes when a request is retried', async () => {
    const store = new InMemoryIngestionStore();

    const first = await ingestSyntheticSources({ store });
    const retry = await ingestSyntheticSources({ store });

    expect(first).toEqual(expect.objectContaining({ queued: 18, processed: 18, skipped: 0, failed: 0 }));
    expect(retry).toEqual(expect.objectContaining({ queued: 18, processed: 0, skipped: 18, failed: 0 }));
    expect(retry.jobId).toBe(first.jobId);
    expect(store.getSource(DEMO_TENANT_ID, 'HBR-DOC-02')?.chunks.length).toBeGreaterThan(0);
  });

  it('accepts only known manifest source IDs', async () => {
    const store = new InMemoryIngestionStore();

    await expect(ingestSyntheticSources({ store, sourceIds: ['../../README.md'] }))
      .rejects.toThrow('Invalid source IDs');
  });
});
