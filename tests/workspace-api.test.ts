import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ identity: vi.fn(), enabled: vi.fn(), origin: vi.fn(), start: vi.fn(), step: vi.fn(),
  cancel: vi.fn(), clear: vi.fn(), authorized: vi.fn(), status: vi.fn(), connection: vi.fn(), disconnect: vi.fn(), ask: vi.fn() }));
vi.mock('../src/lib/access', async importOriginal => ({ ...await importOriginal<typeof import('../src/lib/access')>(), requireBriefIdentity: mocks.identity }));
vi.mock('../src/lib/workspace-config', () => ({ requireWorkspaceEnabled: mocks.enabled, requireWorkspaceOrigin: mocks.origin }));
vi.mock('../src/lib/workspace-import', () => ({ startWorkspaceImport: mocks.start, stepWorkspaceImport: mocks.step,
  cancelWorkspaceImport: mocks.cancel, clearWorkspaceImports: mocks.clear, authorizedWorkspaceSources: mocks.authorized, getWorkspaceStatus: mocks.status }));
vi.mock('../src/lib/workspace-auth', () => ({ workspaceConnectionStatus: mocks.connection, disconnectWorkspaceConnection: mocks.disconnect }));
vi.mock('../src/lib/workspace-query', () => ({ askWorkspace: mocks.ask }));
import { ApiError } from '../src/lib/access';
import { POST as start } from '../src/app/api/workspace/import/route';
import { POST as step } from '../src/app/api/workspace/import/step/route';
import { POST as disconnect } from '../src/app/api/workspace/disconnect/route';
import { POST as ask } from '../src/app/api/workspace/ask/route';
import { GET as source } from '../src/app/api/workspace/sources/[sourceId]/route';
import { GET as status } from '../src/app/api/workspace/status/route';

const identity = { uid: 'fictional-reader', tenantId: 'demo-north-quay' };
const request = (body: unknown) => new Request('https://demo.example/api/workspace/import', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://demo.example' }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks(); mocks.identity.mockResolvedValue(identity);
  mocks.start.mockResolvedValue({ connected: true }); mocks.step.mockResolvedValue({ connected: true });
  mocks.disconnect.mockResolvedValue({ revocation: 'confirmed', connectionId: 'opaque' });
  mocks.clear.mockResolvedValue({ cleared: true });
});
afterEach(() => vi.restoreAllMocks());

describe('Workspace API scope and lifecycle', () => {
  it('rejects disabled integration before reading or importing files', async () => {
    mocks.enabled.mockImplementation(() => { throw new ApiError(503, 'Workspace integration is disabled.'); });
    expect((await start(request({ fileIds: ['file'] }))).status).toBe(503);
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it('requires verified membership and same-origin mutation before imports', async () => {
    mocks.identity.mockRejectedValue(new ApiError(401, 'Authentication required.'));
    expect((await start(request({ fileIds: ['file'] }))).status).toBe(401);
    expect(mocks.start).not.toHaveBeenCalled();
    mocks.identity.mockResolvedValue(identity);
    mocks.origin.mockImplementation(() => { throw new ApiError(403, 'Origin denied.'); });
    expect((await step(request({}))).status).toBe(403);
    expect(mocks.step).not.toHaveBeenCalled();
  });
  it.each([{ fileIds: ['a', 'b', 'c', 'd'] }, { fileIds: ['a', 'a'] }, { fileIds: ['a'], tenantId: 'other' }, { fileIds: ['../file'] }])('rejects invalid selection or caller scope: %j', async body => {
    expect((await start(request(body))).status).toBe(400);
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it('passes only verified owner and validated IDs into the importer', async () => {
    const response = await start(request({ fileIds: ['fictional-file'] }));
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(mocks.start).toHaveBeenCalledWith(identity, ['fictional-file']);
  });
  it('disables access before deleting copies, even while the feature is disabled', async () => {
    const calls: string[] = [];
    mocks.disconnect.mockImplementation(async () => { calls.push('disable'); return { revocation: 'unconfirmed' }; });
    mocks.clear.mockImplementation(async () => { calls.push('cleanup'); throw new Error('provider payload token must not leak'); });
    const response = await disconnect(request({}));
    expect(calls).toEqual(['disable', 'cleanup']); expect(response.status).toBe(207);
    expect(await response.json()).toEqual({ revocation: 'unconfirmed', cleanup: 'incomplete', error: 'Access disabled. Application cleanup incomplete; retry disconnect.' });
    expect(mocks.enabled).not.toHaveBeenCalled();
  });
  it('hides imported source metadata while disconnected', async () => {
    mocks.connection.mockResolvedValue({ connected: false, expiresAt: null, connectionId: null });
    mocks.status.mockResolvedValue({ sources: [{ title: 'stale' }] });
    const response = await status(new Request('https://demo.example/api/workspace/status'));
    expect((await response.json()).sources).toEqual([]);
  });
  it('never falls back to public source lookup when selected source access fails', async () => {
    mocks.authorized.mockRejectedValue(new Error('Forbidden provider token body'));
    const response = await source(new Request('https://demo.example/api/workspace/sources/HBR-DOC-04'), { params: Promise.resolve({ sourceId: 'HBR-DOC-04' }) });
    expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain('token');
  });
  it('rejects caller-supplied source allowlists on Workspace ask', async () => {
    expect((await ask(request({ question: 'QA forecast?', sourceIds: ['HBR-DOC-04'] }))).status).toBe(400);
    expect(mocks.ask).not.toHaveBeenCalled();
  });
});
