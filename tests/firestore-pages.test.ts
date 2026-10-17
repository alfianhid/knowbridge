import { expect, it } from 'vitest';
import type { DocumentData, Query } from 'firebase-admin/firestore';
import { firestoreDocuments } from '../src/lib/firestore-pages';

it('advances beyond 500 retained records and tolerates deletion of cursor documents', async () => {
  for (const remove of [false, true]) {
    const records = new Map(Array.from({ length: 601 }, (_, id) => [id, { id }]));
    const page = (after = -1, size = 100): unknown => ({
      startAfter: (cursor: { id: number }) => page(cursor.id, size),
      limit: (limit: number) => page(after, limit),
      get: async () => {
        const docs = [...records.values()].filter(document => document.id > after).slice(0, size);
        return { docs, size: docs.length };
      },
    });
    const seen: number[] = [];
    for await (const document of firestoreDocuments(page() as Query<DocumentData>)) {
      const id = Number(document.id);
      seen.push(id);
      if (remove) records.delete(id);
    }
    expect(seen).toEqual(Array.from({ length: 601 }, (_, id) => id));
  }
});
