import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { ApiError } from '../src/lib/access';
import { briefFailure } from '../src/lib/brief-errors';
import { requireBriefIdentity } from '../src/lib/access';
import { DEMO_TENANT_ID } from '../src/lib/sources';

afterEach(() => vi.unstubAllEnvs());

const member = { uid: 'member-1', knowbridgeMember: true, knowbridgeTenant: DEMO_TENANT_ID } as unknown as DecodedIdToken;
const authed = (headers: Record<string, string> = {}) => new Request('http://localhost/api/decision-briefs', {
  headers: { authorization: 'Bearer test-token', ...headers },
});

describe('decision brief API boundary', () => {
  it('returns 401 without a bearer token and never reaches brief logic', async () => {
    await expect(requireBriefIdentity(new Request('http://localhost/api/decision-briefs'), vi.fn())).rejects.toMatchObject({ status: 401 });
  });

  it('returns 403 for a verified identity lacking membership or tenant claim', async () => {
    const verifier = vi.fn().mockResolvedValue({ ...member, knowbridgeMember: false });
    await expect(requireBriefIdentity(authed(), verifier)).rejects.toMatchObject({ status: 403 });
  });

  it('maps ApiError to its status and hides unexpected failures behind a fixed message', async () => {
    const conflict = briefFailure(new ApiError(409, 'Idempotency key was already used for a different request.'), 'fallback');
    expect(conflict.status).toBe(409);
    const unexpected = briefFailure(new Error('firestore internals leaked'), 'Saved briefs unavailable.');
    expect(unexpected.status).toBe(503);
    expect(await unexpected.json()).toEqual({ error: 'Saved briefs unavailable.' });
  });

  it('never returns the tenant, owner UID or raw store fields to the client', async () => {
    const { briefResponse } = await import('../src/lib/brief-response');
    const shaped = briefResponse({
      id: '00000000-0000-4000-8000-000000000001', tenantId: DEMO_TENANT_ID, ownerUid: 'member-1',
      question: 'Can Harbour launch?', createdAt: '2026-10-15T00:00:00.000Z', mode: 'vertex', model: 'gemini-3.8-flash',
      sourceAttribution: [], reviewedByHuman: false,
      brief: { question: 'Can Harbour launch?', status: 'insufficient_evidence', recommendation: 'x', supportingClaims: [],
        conflicts: [], alternatives: [], unknowns: ['None.'], suggestedNextStep: 'Collect evidence.', reviewedByHuman: false },
    } as never);
    expect(shaped).not.toHaveProperty('tenantId');
    expect(shaped).not.toHaveProperty('ownerUid');
    expect(shaped.synthetic).toBe(true);
  });
});
