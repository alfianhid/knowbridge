import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { DEMO_TENANT_ID, InMemoryIngestionStore, SyntheticSeedAdapter, ingestSyntheticSources } from '../src/lib/sources';
import { retrieveLocal, selectQuestionSources } from '../src/lib/retrieval';

describe('bounded evaluation corpus', () => {
  it('covers every fixture through the real adapter/store and preserves both policy revisions', async () => {
    const fixtures = JSON.parse(await readFile('seed/generated/evaluation.json', 'utf8')) as { required_source_ids: string[] }[];
    const store = new InMemoryIngestionStore();
    const adapter = new SyntheticSeedAdapter('evaluation');
    const first = await ingestSyntheticSources({ store, adapter });
    const retry = await ingestSyntheticSources({ store, adapter });
    const records = await store.list(DEMO_TENANT_ID);
    const ids = new Set(records.map(source => source.id));
    expect(fixtures.flatMap(item => item.required_source_ids).every(id => ids.has(id))).toBe(true);
    expect(ids.has('POL-DOC-01-V1')).toBe(true);
    expect(ids.has('POL-DOC-01-V2')).toBe(true);
    expect(new Set(records.filter(source => source.id.endsWith('-DOC-04')).map(source => source.projectId)).size).toBe(8);
    expect(records.length).toBeLessThanOrEqual(64);
    expect(first.processed).toBe(records.length);
    expect(retry).toMatchObject({ processed: 0, skipped: records.length, failed: 0, jobId: first.jobId });
    for (const id of ['POL-DOC-01-V1', 'POL-DOC-01-V2']) {
      const policy = records.find(source => source.id === id)!;
      expect(policy.effectiveAt).toMatch(/^2026-/);
      expect(policy.chunks.every(chunk => chunk.effectiveAt === policy.effectiveAt && policy.content.includes(chunk.body))).toBe(true);
    }
    expect(await store.list('private-tenant')).toEqual([]);
  });
  it('rejects unknown IDs, excessive and duplicate requests before writes', async () => {
    const store = new InMemoryIngestionStore();
    const adapter = new SyntheticSeedAdapter('evaluation');
    await expect(adapter.list(['NOT-A-SOURCE'])).rejects.toThrow('Unknown synthetic source ID');
    await expect(ingestSyntheticSources({ store, adapter, sourceIds: ['HBR-DOC-02', 'HBR-DOC-02'] })).rejects.toThrow('Invalid source IDs');
    await expect(ingestSyntheticSources({ store, adapter, sourceIds: Array.from({ length: 65 }, (_, i) => `ID-${i}`) })).rejects.toThrow('Invalid source IDs');
    expect(await store.list(DEMO_TENANT_ID)).toEqual([]);
  });
  it('retrieves each project and treats effective policy revision 2 as current', async () => {
    const sources = await new SyntheticSeedAdapter('evaluation').list();
    const scope = { tenantId: DEMO_TENANT_ID, sourceIds: new Set(sources.map(source => source.id)) };
    const fixtures = JSON.parse(await readFile('seed/generated/evaluation.json', 'utf8')) as { project?: string; question: string; required_source_ids: string[] }[];
    for (const fixture of fixtures.filter(item => item.project)) {
      const selected = selectQuestionSources(fixture.question, sources, scope);
      expect(selected.filter(source => !source.id.startsWith('POL-')).every(source => source.projectId === fixture.project)).toBe(true);
      expect(selected.some(source => source.id === 'HBR-DOC-07')).toBe(false);
      const ids = retrieveLocal(fixture.question, sources, scope).map(chunk => chunk.sourceId);
      for (const id of fixture.required_source_ids) expect(ids, fixture.question).toContain(id);
    }
    const policy = retrieveLocal('What approvals are required before any production launch?', sources, scope);
    expect(policy.map(chunk => chunk.sourceId)).toContain('POL-DOC-01-V2');
    expect(policy.map(chunk => chunk.sourceId)).not.toContain('POL-DOC-01-V1');
    const history = retrieveLocal('Compare launch readiness policy revision 1 and revision 2', sources, scope);
    expect(history.map(chunk => chunk.sourceId)).toContain('POL-DOC-01-V1');
    expect(history.map(chunk => chunk.sourceId)).toContain('POL-DOC-01-V2');
  });
  it('retains directly requested runbooks and support evidence outside readiness decisions', async () => {
    const sources = await new SyntheticSeedAdapter('evaluation').list();
    const scope = { tenantId: DEMO_TENANT_ID, sourceIds: new Set(sources.map(source => source.id)) };
    expect(selectQuestionSources('What sequence does the Project Harbour launch runbook propose?', sources, scope).map(source => source.id)).toContain('HBR-DOC-11');
    expect(selectQuestionSources('Who coordinates Project Harbour post-launch support handover?', sources, scope).map(source => source.id)).toContain('HBR-DOC-10');
  });
});
