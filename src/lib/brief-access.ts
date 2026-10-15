import { createHash } from 'node:crypto';
import { ApiError, type BriefIdentity } from './access';

interface BriefOwner { tenantId: string; ownerUid: string }

export function assertBriefOwner(identity: BriefIdentity, brief: BriefOwner): void {
  if (brief.tenantId !== identity.tenantId || brief.ownerUid !== identity.uid) {
    throw new ApiError(404, 'Brief not found.');
  }
}

export function briefIdempotencyId(identity: BriefIdentity, key: string): string {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(key)) throw new ApiError(400, 'Valid idempotency key required.');
  return createHash('sha256').update(JSON.stringify([identity.tenantId, identity.uid, key])).digest('hex');
}

// Called only after requireBriefIdentity and a deliberate owner review request in Phase 3.
export function createReview(identity: BriefIdentity, brief: BriefOwner): {
  reviewedByHuman: true; reviewerUid: string; reviewedAt: string;
} {
  assertBriefOwner(identity, brief);
  return { reviewedByHuman: true, reviewerUid: identity.uid, reviewedAt: new Date().toISOString() };
}
