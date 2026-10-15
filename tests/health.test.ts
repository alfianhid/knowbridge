import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../src/app/api/health/route';

afterEach(() => vi.unstubAllEnvs());
describe('health configuration readiness', () => {
  it('reports local evidence lookup without claiming AI or connectivity', async () => {
    vi.stubEnv('KNOWBRIDGE_RETRIEVAL', 'local');
    vi.stubEnv('KNOWBRIDGE_STORE', 'file');
    expect(await GET().json()).toMatchObject({ aiEnabled: false, retrieval: 'local', connectivityVerified: false });
  });
  it('refuses incompatible deployment storage or missing Vertex settings', () => {
    vi.stubEnv('KNOWBRIDGE_RETRIEVAL', 'vertex');
    vi.stubEnv('KNOWBRIDGE_STORE', 'file');
    expect(GET().status).toBe(503);
    vi.stubEnv('KNOWBRIDGE_STORE', 'firestore');
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', '');
    expect(GET().status).toBe(503);
  });
});
