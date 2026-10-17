import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { ApiError } from './access';
import { DecisionBriefSchema } from './contracts';
import { getDatabase } from './firebase';
import { DEMO_TENANT_ID } from './sources';

export const BRIEF_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const IDEMPOTENCY_CONFLICT = 'Idempotency key was already used for a different request.';
const MAX_LIST = 50;

const IdempotencyRecordSchema = z.object({
  requestHash: z.string().regex(/^[a-f0-9]{64}$/),
  briefId: z.string().regex(BRIEF_ID_PATTERN),
});

export const StoredBriefSchema = z.object({
  id: z.string().regex(BRIEF_ID_PATTERN),
  tenantId: z.literal(DEMO_TENANT_ID),
  ownerUid: z.string().min(1),
  question: z.string().min(4).max(2000),
  createdAt: z.iso.datetime(),
  mode: z.literal('vertex'),
  model: z.string().min(1),
  sourceAttribution: z.array(z.object({
    sourceId: z.string().regex(/^[A-Z0-9-]{1,64}$/),
    contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  })),
  brief: DecisionBriefSchema,
  reviewedByHuman: z.boolean(),
  reviewerUid: z.string().min(1).optional(),
  reviewedAt: z.iso.datetime().optional(),
});
export type StoredBrief = z.infer<typeof StoredBriefSchema>;

export interface BriefStore {
  findIdempotent(tenantId: string, idempotencyId: string): Promise<{ requestHash: string; brief: StoredBrief } | null>;
  // Atomically creates a brief or returns the original for an identical retry; a different request is rejected.
  createOnce(brief: StoredBrief, idempotencyId: string, requestHash: string): Promise<{ brief: StoredBrief; created: boolean }>;
  get(tenantId: string, briefId: string): Promise<StoredBrief | null>;
  listForOwner(tenantId: string, ownerUid: string): Promise<StoredBrief[]>;
  // Idempotent: an already reviewed brief is returned unchanged.
  markReviewed(tenantId: string, briefId: string, review: { reviewerUid: string; reviewedAt: string }): Promise<StoredBrief | null>;
}

function newestFirst(a: StoredBrief, b: StoredBrief): number {
  return b.createdAt.localeCompare(a.createdAt);
}

export class InMemoryBriefStore implements BriefStore {
  private readonly briefs = new Map<string, StoredBrief>();
  private readonly idempotency = new Map<string, { requestHash: string; briefId: string }>();

  async findIdempotent(tenantId: string, idempotencyId: string) {
    const record = this.idempotency.get(`${tenantId}:${idempotencyId}`);
    if (!record) return null;
    const brief = await this.get(tenantId, record.briefId);
    if (!brief) throw new Error('Idempotency record references a missing brief.');
    return { requestHash: record.requestHash, brief };
  }

  async createOnce(brief: StoredBrief, idempotencyId: string, requestHash: string) {
    const validated = StoredBriefSchema.parse(brief);
    const key = `${validated.tenantId}:${idempotencyId}`;
    const existing = this.idempotency.get(key);
    if (existing) {
      if (existing.requestHash !== requestHash) throw new ApiError(409, IDEMPOTENCY_CONFLICT);
      const original = await this.get(validated.tenantId, existing.briefId);
      if (!original) throw new Error('Idempotency record references a missing brief.');
      return { brief: original, created: false };
    }
    this.briefs.set(`${validated.tenantId}:${validated.id}`, structuredClone(validated));
    this.idempotency.set(key, { requestHash, briefId: validated.id });
    return { brief: structuredClone(validated), created: true };
  }

  async get(tenantId: string, briefId: string) {
    const brief = this.briefs.get(`${tenantId}:${briefId}`);
    return brief ? structuredClone(brief) : null;
  }

  async listForOwner(tenantId: string, ownerUid: string) {
    return [...this.briefs.values()]
      .filter(brief => brief.tenantId === tenantId && brief.ownerUid === ownerUid)
      .map(brief => structuredClone(brief))
      .sort(newestFirst)
      .slice(0, MAX_LIST);
  }

  async markReviewed(tenantId: string, briefId: string, review: { reviewerUid: string; reviewedAt: string }) {
    const current = this.briefs.get(`${tenantId}:${briefId}`);
    if (!current) return null;
    if (current.reviewedByHuman) return structuredClone(current);
    const updated = StoredBriefSchema.parse({
      ...current, reviewedByHuman: true, reviewerUid: review.reviewerUid, reviewedAt: review.reviewedAt,
      brief: { ...current.brief, reviewedByHuman: true },
    });
    this.briefs.set(`${tenantId}:${briefId}`, structuredClone(updated));
    return structuredClone(updated);
  }
}

export class FirestoreBriefStore implements BriefStore {
  constructor(private readonly database: Firestore = getDatabase()) {}

  private briefRef(tenantId: string, briefId: string) {
    return this.database.doc(`tenants/${tenantId}/briefs/${briefId}`);
  }

  async findIdempotent(tenantId: string, idempotencyId: string) {
    const record = await this.database.doc(`tenants/${tenantId}/briefIdempotency/${idempotencyId}`).get();
    if (!record.exists) return null;
    const { requestHash, briefId } = IdempotencyRecordSchema.parse(record.data());
    const brief = await this.get(tenantId, briefId);
    if (!brief) throw new Error('Idempotency record references a missing brief.');
    return { requestHash, brief };
  }

  async createOnce(brief: StoredBrief, idempotencyId: string, requestHash: string) {
    const validated = StoredBriefSchema.parse(brief);
    const idempotency = this.database.doc(`tenants/${validated.tenantId}/briefIdempotency/${idempotencyId}`);
    const reference = this.briefRef(validated.tenantId, validated.id);
    return this.database.runTransaction(async transaction => {
      const existing = await transaction.get(idempotency);
      if (existing.exists) {
        const record = IdempotencyRecordSchema.parse(existing.data());
        if (record.requestHash !== requestHash) throw new ApiError(409, IDEMPOTENCY_CONFLICT);
        const original = await transaction.get(this.briefRef(validated.tenantId, record.briefId));
        if (!original.exists) throw new Error('Idempotency record references a missing brief.');
        return { brief: StoredBriefSchema.parse(original.data()), created: false };
      }
      transaction.set(reference, JSON.parse(JSON.stringify(validated)));
      transaction.set(idempotency, { requestHash, briefId: validated.id, createdAt: FieldValue.serverTimestamp() });
      return { brief: validated, created: true };
    });
  }

  async get(tenantId: string, briefId: string) {
    const snapshot = await this.briefRef(tenantId, briefId).get();
    if (!snapshot.exists) return null;
    const brief = StoredBriefSchema.parse(snapshot.data());
    if (brief.tenantId !== tenantId || brief.id !== briefId) throw new Error('Stored brief provenance mismatch.');
    return brief;
  }

  async listForOwner(tenantId: string, ownerUid: string) {
    // Tenant and owner are constrained in the query itself, before any document is read.
    const snapshot = await this.database.collection(`tenants/${tenantId}/briefs`)
      .where('ownerUid', '==', ownerUid).orderBy('createdAt', 'desc').limit(MAX_LIST).get();
    return snapshot.docs.map(doc => StoredBriefSchema.parse(doc.data())).sort(newestFirst);
  }

  async markReviewed(tenantId: string, briefId: string, review: { reviewerUid: string; reviewedAt: string }) {
    const reference = this.briefRef(tenantId, briefId);
    return this.database.runTransaction(async transaction => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return null;
      const current = StoredBriefSchema.parse(snapshot.data());
      if (current.reviewedByHuman) return current;
      const updated = StoredBriefSchema.parse({
        ...current, reviewedByHuman: true, reviewerUid: review.reviewerUid, reviewedAt: review.reviewedAt,
        brief: { ...current.brief, reviewedByHuman: true },
      });
      transaction.set(reference, JSON.parse(JSON.stringify(updated)));
      return updated;
    });
  }
}

// Briefs persist only in Firestore: Vertex retrieval, which briefs require, already runs against Firestore.
export function getBriefStore(): BriefStore {
  const mode = process.env.KNOWBRIDGE_STORE ?? (process.env.K_SERVICE ? 'firestore' : 'file');
  if (mode !== 'firestore') throw new ApiError(503, 'Decision briefs require Firestore storage.');
  return new FirestoreBriefStore();
}
