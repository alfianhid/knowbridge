import { describe, expect, it } from 'vitest';
import {
  DEMO_TENANT_ID,
  getSourceForTenant,
  listSourcesForTenant,
  loadSyntheticSources,
} from '../src/lib/sources';

describe('synthetic source import', () => {
  it('loads a deterministic bounded batch of 24 docs and 3 sheets', async () => {
    const first = await loadSyntheticSources();
    const second = await loadSyntheticSources();

    expect(first).toHaveLength(27);
    expect(first.filter((source) => source.kind === 'google_doc')).toHaveLength(24);
    expect(first.filter((source) => source.kind === 'google_sheet')).toHaveLength(3);
    expect(first.map(({ id, contentHash }) => ({ id, contentHash }))).toEqual(
      second.map(({ id, contentHash }) => ({ id, contentHash })),
    );
    expect(first.every((source) => source.tenantId === DEMO_TENANT_ID)).toBe(true);
    expect(first.every((source) => source.synthetic)).toBe(true);
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
    await expect(listSourcesForTenant(DEMO_TENANT_ID)).resolves.toHaveLength(27);
    await expect(listSourcesForTenant('other-tenant')).resolves.toEqual([]);
  });

  it('returns the same result for missing and unauthorized source lookups', async () => {
    await expect(getSourceForTenant(DEMO_TENANT_ID, 'MISSING')).resolves.toBeNull();
    await expect(getSourceForTenant('other-tenant', 'HBR-DOC-02')).resolves.toBeNull();
  });
});
