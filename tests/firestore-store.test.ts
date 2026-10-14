import type { Firestore } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { FirestoreSourceStore } from '../src/lib/source-store';
import { DEMO_TENANT_ID, loadSyntheticSources } from '../src/lib/sources';

describe('Firestore store contract', () => {
  it('scopes reads, atomically replaces source/chunks, persists retry and quota state', async () => {
    const data = new Map<string, unknown>();
    const reads: string[] = [];
    const snapshot = (key: string) => ({ id: key.split('/').at(-1), exists: data.has(key), data: () => data.get(key) });
    const database = {
      doc: (key: string) => ({ key, get: async () => { reads.push(key); return snapshot(key); } }),
      collection: (prefix: string) => ({ limit: () => ({ get: async () => ({ docs: [...data.keys()].filter(key => key.startsWith(prefix + '/')).map(snapshot) }) }) }),
      runTransaction: async (action: (transaction: unknown) => Promise<unknown>) => action({
        get: async ({ key }: { key: string }) => snapshot(key),
        set: ({ key }: { key: string }, value: unknown) => data.set(key, value),
      }),
    } as unknown as Firestore;
    const source = (await loadSyntheticSources())[0];
    const a = new FirestoreSourceStore(database);
    expect(await a.upsert(source)).toBe('processed');
    const b = new FirestoreSourceStore(database);
    expect(await b.upsert(source)).toBe('skipped');
    expect(await b.get(DEMO_TENANT_ID, source.id)).toEqual(source);
    expect(await b.list(DEMO_TENANT_ID)).toEqual([source]);
    expect(await b.get('other', source.id)).toBeNull();
    expect(await b.list('other')).toEqual([]);
    expect(reads).toEqual([`tenants/${DEMO_TENANT_ID}/sources/${source.id}`]);
    for (let i = 0; i < 5; i++) expect(await b.consumeIngestionQuota('admin', 60000)).toBe(true);
    expect(await a.consumeIngestionQuota('admin', 60000)).toBe(false);
    expect(await a.consumeIngestionQuota('admin', 120000)).toBe(true);
  });
});
