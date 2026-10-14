import { describe, expect, it, vi } from 'vitest';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { authorizeChunks, requireIngestionAdmin } from '../src/lib/access';
import { DEMO_TENANT_ID, loadSyntheticSources } from '../src/lib/sources';

describe('verified identity boundary', () => {
  const identity = { uid: 'admin', knowbridgeAdmin: true, knowbridgeTenant: DEMO_TENANT_ID } as unknown as DecodedIdToken;
  const request = (token = 'valid') => new Request('http://localhost/api/ingest', { headers: { authorization: `Bearer ${token}` } });
  it('checks revocation and verified admin/tenant claims', async () => {
    const verify = vi.fn().mockResolvedValue(identity);
    expect(await requireIngestionAdmin(request(), verify)).toBe('admin');
    expect(verify).toHaveBeenCalledWith('valid', true);
    await expect(requireIngestionAdmin(request(), vi.fn().mockResolvedValue({ ...identity, knowbridgeAdmin: false }))).rejects.toMatchObject({ status: 403 });
    await expect(requireIngestionAdmin(request(), vi.fn().mockResolvedValue({ ...identity, knowbridgeTenant: 'other' }))).rejects.toMatchObject({ status: 403 });
  });
  it.each(['expired', 'revoked', 'invalid'])('rejects %s tokens', async () => {
    await expect(requireIngestionAdmin(request(), vi.fn().mockRejectedValue(new Error('invalid')))).rejects.toMatchObject({ status: 401 });
  });
  it('rejects malformed schemes without invoking verifier', async () => {
    const verify = vi.fn();
    for (const header of ['', 'Basic abc', 'Bearer ', 'Bearer a b', `Bearer ${'x'.repeat(8192)}`]) {
      await expect(requireIngestionAdmin(new Request('http://localhost', { headers: { authorization: header } }), verify)).rejects.toMatchObject({ status: 401 });
    }
    expect(verify).not.toHaveBeenCalled();
  });
  it('rejects unauthorized chunks before any caller can use them as model context', async () => {
    const source = (await loadSyntheticSources())[0];
    const scope = { tenantId: DEMO_TENANT_ID, sourceIds: new Set([source.id]) };
    expect(authorizeChunks(source.chunks, scope)).toEqual(source.chunks);
    expect(() => authorizeChunks(source.chunks, { ...scope, tenantId: 'other' })).toThrow('Source access denied');
    expect(() => authorizeChunks(source.chunks, { ...scope, sourceIds: new Set() })).toThrow('Source access denied');
  });
});
