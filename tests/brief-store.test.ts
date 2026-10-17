import type { Firestore } from 'firebase-admin/firestore';
import { describe, expect, it, vi } from 'vitest';
import { FirestoreBriefStore } from '../src/lib/brief-store';
import { DEMO_TENANT_ID } from '../src/lib/sources';

describe('Firestore saved brief query', () => {
  it('orders owner-scoped records before limiting to the newest 50', async () => {
    const get = vi.fn(async () => ({ docs: [] }));
    const limit = vi.fn(() => ({ get }));
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ orderBy }));
    const collection = vi.fn(() => ({ where }));
    const store = new FirestoreBriefStore({ collection } as unknown as Firestore);
    expect(await store.listForOwner(DEMO_TENANT_ID, 'member-1')).toEqual([]);
    expect(collection).toHaveBeenCalledWith(`tenants/${DEMO_TENANT_ID}/briefs`);
    expect(where).toHaveBeenCalledWith('ownerUid', '==', 'member-1');
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(limit).toHaveBeenCalledWith(50);
  });
});
