import { describe, expect, it, vi } from 'vitest';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { requireBriefIdentity } from '../src/lib/access';
import { assertBriefOwner, briefIdempotencyId, createReview } from '../src/lib/brief-access';
import { DEMO_TENANT_ID } from '../src/lib/sources';

const identity = { uid: 'member-1', knowbridgeMember: true, knowbridgeTenant: DEMO_TENANT_ID } as unknown as DecodedIdToken;
const request = (headers = {}) => new Request('http://localhost/api/decision-briefs', { headers: { authorization: 'Bearer test', ...headers } });
describe('future brief identity boundary', () => {
  it('requires revoked-token-checked membership, independent of public read access', async () => {
    const verifier = vi.fn().mockResolvedValue(identity);
    expect(await requireBriefIdentity(request(), verifier)).toEqual({ uid: identity.uid, tenantId: DEMO_TENANT_ID });
    expect(verifier).toHaveBeenCalledWith('test', true);
    for (const changed of [{ knowbridgeTenant: 'private' }, { knowbridgeMember: false }, { uid: '' }]) {
      await expect(requireBriefIdentity(request(), vi.fn().mockResolvedValue({ ...identity, ...changed }))).rejects.toMatchObject({ status: 403 });
    }
    await expect(requireBriefIdentity(request({ 'x-knowbridge-tenant': 'private' }), verifier)).rejects.toMatchObject({ status: 403 });
    await expect(requireBriefIdentity(new Request('http://localhost'), verifier)).rejects.toMatchObject({ status: 401 });
  });
  it.each(['revoked', 'expired', 'invalid'])('rejects %s identity', async () => {
    await expect(requireBriefIdentity(request(), vi.fn().mockRejectedValue(new Error('invalid')))).rejects.toMatchObject({ status: 401 });
  });
  it('hides cross-user/cross-tenant briefs and derives review attribution server-side', () => {
    const actor = { uid: identity.uid, tenantId: DEMO_TENANT_ID };
    const brief = { ownerUid: actor.uid, tenantId: actor.tenantId };
    expect(() => assertBriefOwner(actor, brief)).not.toThrow();
    expect(() => assertBriefOwner({ ...actor, uid: 'another' }, brief)).toThrow('Brief not found');
    expect(() => assertBriefOwner({ ...actor, tenantId: 'private' }, brief)).toThrow('Brief not found');
    const review = createReview(actor, brief);
    expect(review).toMatchObject({ reviewedByHuman: true, reviewerUid: actor.uid });
    expect(Number.isNaN(Date.parse(review.reviewedAt))).toBe(false);
  });
  it('scopes retry keys to verified tenant and user', () => {
    const actor = { uid: identity.uid, tenantId: DEMO_TENANT_ID };
    const key = 'request-key-123';
    expect(briefIdempotencyId(actor, key)).toBe(briefIdempotencyId(actor, key));
    expect(briefIdempotencyId(actor, key)).not.toBe(briefIdempotencyId({ ...actor, uid: 'another' }, key));
    expect(briefIdempotencyId(actor, key)).not.toBe(briefIdempotencyId({ ...actor, tenantId: 'another' }, key));
    for (const invalid of ['', 'short', '../bad-key', 'x'.repeat(129)]) expect(() => briefIdempotencyId(actor, invalid)).toThrow();
  });
});
