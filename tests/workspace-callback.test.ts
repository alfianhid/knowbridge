import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ finish: vi.fn() }));
vi.mock('../src/lib/workspace-auth', () => ({ finishWorkspaceOAuth: mocks.finish }));
vi.mock('../src/lib/api-limits', () => ({ limitPublicReads: vi.fn() }));
vi.mock('../src/lib/workspace-config', async importOriginal => ({
  ...await importOriginal<typeof import('../src/lib/workspace-config')>(),
  getWorkspaceConfig: () => ({ origin: 'https://demo.example' }),
}));
import { GET } from '../src/app/api/workspace/oauth/callback/route';

beforeEach(() => { vi.stubEnv('K_SERVICE', 'knowbridge'); mocks.finish.mockResolvedValue(undefined); });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('Workspace callback behind Cloud Run HTTPS termination', () => {
  it('exchanges only on the configured HTTPS host and redirects without credentials', async () => {
    const request = new NextRequest('http://localhost:8080/api/workspace/oauth/callback?state=fictional-state&code=fictional-code', {
      headers: { host: 'demo.example', 'x-forwarded-proto': 'https', cookie: 'workspace_oauth=fictional-binding' },
    });
    const response = await GET(request);
    expect(mocks.finish).toHaveBeenCalledWith('fictional-state', 'fictional-code', 'fictional-binding');
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://demo.example/?workspace=connected');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.cookies.get('workspace_oauth')?.value).toBe('');
  });

  it.each<Record<string, string>>([
    { host: 'hostile.example', 'x-forwarded-proto': 'https' },
    { 'x-forwarded-host': 'demo.example', 'x-forwarded-proto': 'https' },
    { host: 'demo.example', 'x-forwarded-proto': 'http' },
  ])('rejects untrusted proxy headers before exchanging a code: %j', async headers => {
    const response = await GET(new NextRequest('http://localhost:8080/api/workspace/oauth/callback?state=fictional-state&code=fictional-code', { headers }));
    expect(mocks.finish).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe('https://demo.example/?workspace=error');
  });
});
