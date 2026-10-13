import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileSourceStore } from '../src/lib/source-store';
import { DEMO_TENANT_ID, ingestSyntheticSources, loadSyntheticSources } from '../src/lib/sources';

describe('durable ingestion', () => {
  it('lists only ingested sources, survives restart, and skips concurrent retries', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'knowbridge-store-'));
    try {
      const first = new FileSourceStore(directory);
      expect(await first.list(DEMO_TENANT_ID)).toEqual([]);
      const result = await ingestSyntheticSources({ store: first, sourceIds: ['HBR-DOC-02'] });
      expect(result.processed).toBe(1);
      const restarted = new FileSourceStore(directory);
      expect((await restarted.list(DEMO_TENANT_ID)).map(s => s.id)).toEqual(['HBR-DOC-02']);
      const retries = await Promise.all([first, restarted].map(store =>
        ingestSyntheticSources({ store, sourceIds: ['HBR-DOC-02'] })));
      expect(retries.every(r => r.skipped === 1 && r.processed === 0)).toBe(true);
      expect(await restarted.list('other-tenant')).toEqual([]);
      expect(await restarted.get('other-tenant', 'HBR-DOC-02')).toBeNull();
      const source = (await loadSyntheticSources()).find(s => s.id === 'HBR-DOC-02')!;
      const content = source.content.replace('2026-11-01', '2026-11-02');
      const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
      const changed = { ...source, content, contentHash: hash(content), chunks: source.chunks.map(chunk => {
        const body = chunk.body.replace('2026-11-01', '2026-11-02');
        return { ...chunk, body, checksum: hash(body) };
      }) };
      expect(await restarted.upsert(changed)).toBe('processed');
      expect((await first.get(DEMO_TENANT_ID, source.id))?.content).toBe(content);
      const renamed = { ...changed, title: 'Updated title', chunks: changed.chunks.map(chunk => ({ ...chunk, title: 'Updated title' })) };
      expect(await restarted.upsert(renamed)).toBe('processed');
      expect((await first.get(DEMO_TENANT_ID, source.id))?.title).toBe('Updated title');
      expect(await first.upsert(renamed)).toBe('skipped');
      await expect(restarted.upsert({ ...source, content: 'changed' })).rejects.toThrow('Invalid stored evidence');
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
  it('persists quotas across instances and resets on minute rollover', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'knowbridge-quota-'));
    try {
      const a = new FileSourceStore(directory);
      const b = new FileSourceStore(directory);
      const consumed = await Promise.all(Array.from({ length: 6 }, (_, i) => (i % 2 ? a : b).consumeIngestionQuota('admin', 60000)));
      expect(consumed.filter(Boolean)).toHaveLength(5);
      expect(await new FileSourceStore(directory).consumeIngestionQuota('admin', 60000)).toBe(false);
      expect(await a.consumeIngestionQuota('other-admin', 60000)).toBe(true);
      expect(await b.consumeIngestionQuota('admin', 120000)).toBe(true);
      await writeFile(path.join(directory, 'quota.json'), '{');
      await expect(a.consumeIngestionQuota('admin')).rejects.toThrow();
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
