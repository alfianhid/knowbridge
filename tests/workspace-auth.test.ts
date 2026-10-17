import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disconnectWorkspaceConnection, finishWorkspaceOAuth, getWorkspaceConnection, startWorkspaceOAuth, validateOAuthAttempt } from '../src/lib/workspace-auth';
import { getWorkspaceConfig, requireWorkspaceEnabled, requireWorkspaceOrigin, workspacePublicConfig, workspaceRequestHasOrigin } from '../src/lib/workspace-config';

const mocks = vi.hoisted(() => ({ records: new Map<string, unknown>(), token: vi.fn(), verify: vi.fn(), kms: vi.fn(), revoke: vi.fn(), clear: vi.fn() }));
vi.mock('../src/lib/workspace-import', () => ({ clearWorkspaceImports: mocks.clear }));
vi.mock('../src/lib/firebase', () => ({ getDatabase: () => ({
  collection: (collection: string) => ({ doc: (id: string) => ({ key: `${collection}/${id}`, get: async () => ({ data: () => mocks.records.get(`${collection}/${id}`) }) }) }),
  runTransaction: async (fn: (transaction: unknown) => unknown) => fn({
    get: async (ref: { key: string }) => ({ data: () => mocks.records.get(ref.key) }),
    create: (ref: { key: string }, value: unknown) => mocks.records.set(ref.key, value),
    set: (ref: { key: string }, value: unknown) => mocks.records.set(ref.key, value),
    delete: (ref: { key: string }) => mocks.records.delete(ref.key),
  }),
}) }));
vi.mock('google-auth-library', () => ({
  CodeChallengeMethod: { S256: 'S256' },
  GoogleAuth: class { async getClient() { return { request: mocks.kms }; } },
  OAuth2Client: class {
    transporter = { defaults: {} };
    generateAuthUrl(input: Record<string, string>) { return `https://accounts.google.com?state=${input.state}`; }
    getToken = mocks.token; verifyIdToken = mocks.verify; revokeToken = mocks.revoke;
  },
}));
beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 }))));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); mocks.records.clear(); vi.clearAllMocks(); });
const binding = 'server-session-secret';
const attempt = { ownerUid: 'member', tenantId: 'fictional', binding: createHash('sha256').update(binding).digest('hex'), verifier: 'verifier', nonce: 'nonce', expiresAt: 1000, generation: 0 };
function configure() {
  for (const [key, value] of Object.entries({ WORKSPACE_ORIGIN: 'https://demo.example', WORKSPACE_KMS_KEY: 'projects/p/locations/l/keyRings/r/cryptoKeys/k', WORKSPACE_ALLOWED_SUBJECTS: 'fictional-account', WORKSPACE_REGISTRY_JSON: '[{"fileId":"file","sourceId":"HBR-DOC-02","subject":"fictional-account"}]', GOOGLE_OAUTH_CLIENT_ID: 'client', GOOGLE_OAUTH_CLIENT_SECRET: 'secret', GOOGLE_PICKER_API_KEY: 'key', GOOGLE_PICKER_APP_ID: 'app' })) vi.stubEnv(key, value);
}
describe('Workspace OAuth boundary', () => {
  it('requires the exact state cookie binding and rejects absent, expired and consumed attempts', () => {
    expect(() => validateOAuthAttempt(attempt, binding, 999)).not.toThrow();
    expect(() => validateOAuthAttempt(attempt, 'different', 999)).toThrow();
    expect(() => validateOAuthAttempt(attempt, '', 999)).toThrow();
    expect(() => validateOAuthAttempt(attempt, binding, 1000)).toThrow();
    expect(() => validateOAuthAttempt(undefined, binding, 999)).toThrow();
  });
  it('defaults disabled even with complete configuration', () => {
    configure(); vi.stubEnv('KNOWBRIDGE_WORKSPACE_ENABLED', 'false');
    expect(workspacePublicConfig()).toEqual({ enabled: false, configured: true });
    expect(requireWorkspaceEnabled).toThrow('disabled');
  });
  it('requires exact mutation origin, rejects missing and hostile origins', () => {
    configure();
    expect(() => requireWorkspaceOrigin(new Request('https://demo.example/api', { headers: { origin: 'https://demo.example' } }))).not.toThrow();
    expect(() => requireWorkspaceOrigin(new Request('https://demo.example/api'))).toThrow();
    expect(() => requireWorkspaceOrigin(new Request('https://demo.example/api', { headers: { origin: 'https://demo.example.attacker.test' } }))).toThrow();
  });

  it('accepts Cloud Run HTTPS termination only for the configured host and exact browser origin', () => {
    configure(); vi.stubEnv('K_SERVICE', 'knowbridge');
    const headers = { origin: 'https://demo.example', host: 'demo.example', 'x-forwarded-proto': 'https' };
    const request = new Request('http://localhost:8080/api', { headers });
    expect(() => requireWorkspaceOrigin(request)).not.toThrow();
    expect(workspaceRequestHasOrigin(request, 'https://demo.example')).toBe(true);
    for (const override of [{ host: 'hostile.example' }, { 'x-forwarded-proto': 'http' }, { origin: 'https://hostile.example' }]) {
      expect(() => requireWorkspaceOrigin(new Request(request.url, { headers: { ...headers, ...override } }))).toThrow();
    }
    expect(workspaceRequestHasOrigin(new Request(request.url, { headers: { 'x-forwarded-host': 'demo.example', 'x-forwarded-proto': 'https' } }), 'https://demo.example')).toBe(false);
    vi.stubEnv('K_SERVICE', '');
    expect(() => requireWorkspaceOrigin(request)).toThrow();
  });

  it('permits same-origin authenticated cleanup after configuration removal', () => {
    vi.stubEnv('WORKSPACE_ORIGIN', '');
    const request = new Request('https://demo.example/api', { headers: { origin: 'https://demo.example' } });
    expect(() => requireWorkspaceOrigin(request, true)).not.toThrow();
    expect(() => requireWorkspaceOrigin(request)).toThrow();
    expect(() => requireWorkspaceOrigin(new Request('https://demo.example/api', { headers: { origin: 'https://hostile.example' } }), true)).toThrow();
  });
  it('fails closed for non-local HTTP and unregistered registry subjects', () => {
    configure(); vi.stubEnv('WORKSPACE_ORIGIN', 'http://demo.example');
    expect(getWorkspaceConfig).toThrow();
    vi.stubEnv('WORKSPACE_ORIGIN', 'https://demo.example');
    vi.stubEnv('WORKSPACE_ALLOWED_SUBJECTS', 'another-account');
    expect(getWorkspaceConfig).toThrow('account');
  });
  it('consumes state before provider exchange and rejects callback replay', async () => {
    configure(); vi.stubEnv('KNOWBRIDGE_WORKSPACE_ENABLED', 'true');
    const started = await startWorkspaceOAuth({ uid: 'owner', tenantId: 'fictional' });
    const state = new URL(started.authorizationUrl).searchParams.get('state')!;
    mocks.token.mockRejectedValueOnce(new Error('provider down'));
    await expect(finishWorkspaceOAuth(state, 'code', started.binding)).rejects.toThrow();
    await expect(finishWorkspaceOAuth(state, 'code', started.binding)).rejects.toThrow('expired or invalid');
    expect(mocks.token).toHaveBeenCalledTimes(1);
  });
  it('rejects unregistered Google identity before encryption', async () => {
    configure(); vi.stubEnv('KNOWBRIDGE_WORKSPACE_ENABLED', 'true');
    const started = await startWorkspaceOAuth({ uid: 'owner', tenantId: 'fictional' });
    const state = new URL(started.authorizationUrl).searchParams.get('state')!;
    const pending = [...mocks.records.values()][0] as { nonce: string };
    mocks.token.mockResolvedValueOnce({ tokens: { scope: 'openid https://www.googleapis.com/auth/drive.file', id_token: 'id', access_token: 'private', expiry_date: Date.now() + 10000 } });
    mocks.verify.mockResolvedValueOnce({ getPayload: () => ({ iss: 'https://accounts.google.com', nonce: pending.nonce, sub: 'unregistered' }) });
    await expect(finishWorkspaceOAuth(state, 'code', started.binding)).rejects.toThrow('not registered');
    expect(mocks.kms).not.toHaveBeenCalled();
  });
  it('never stores plaintext if encryption fails', async () => {
    configure(); vi.stubEnv('KNOWBRIDGE_WORKSPACE_ENABLED', 'true');
    const started = await startWorkspaceOAuth({ uid: 'owner', tenantId: 'fictional' });
    const state = new URL(started.authorizationUrl).searchParams.get('state')!;
    const pending = [...mocks.records.values()][0] as { nonce: string };
    mocks.token.mockResolvedValueOnce({ tokens: { scope: 'openid https://www.googleapis.com/auth/drive.file', id_token: 'id', access_token: 'private', expiry_date: Date.now() + 10000 } });
    mocks.verify.mockResolvedValueOnce({ getPayload: () => ({ iss: 'https://accounts.google.com', nonce: pending.nonce, sub: 'fictional-account' }) });
    mocks.kms.mockRejectedValueOnce(new Error('KMS unavailable'));
    await expect(finishWorkspaceOAuth(state, 'code', started.binding)).rejects.toThrow();
    expect([...mocks.records.keys()].some(key => key.startsWith('workspace_connections/'))).toBe(false);
  });
  it('disconnect works while feature disabled and invalidates pending owner state', async () => {
    configure(); vi.stubEnv('KNOWBRIDGE_WORKSPACE_ENABLED', 'true');
    const identity = { uid: 'owner', tenantId: 'fictional' };
    const started = await startWorkspaceOAuth(identity);
    const state = new URL(started.authorizationUrl).searchParams.get('state')!;
    vi.stubEnv('KNOWBRIDGE_WORKSPACE_ENABLED', 'false');
    await expect(disconnectWorkspaceConnection(identity)).resolves.toEqual({ revocation: 'unconfirmed', connectionId: null });
    await expect(getWorkspaceConnection(identity)).rejects.toThrow('disabled');
    vi.stubEnv('KNOWBRIDGE_WORKSPACE_ENABLED', 'true');
    const pending = [...mocks.records.entries()].find(([key]) => key.startsWith('workspace_oauth_attempts/'))![1] as { nonce: string };
    mocks.token.mockResolvedValueOnce({ tokens: { scope: 'openid https://www.googleapis.com/auth/drive.file', id_token: 'id', access_token: 'private', expiry_date: Date.now() + 10000 } });
    mocks.verify.mockResolvedValueOnce({ getPayload: () => ({ iss: 'https://accounts.google.com', nonce: pending.nonce, sub: 'fictional-account' }) });
    mocks.kms.mockResolvedValueOnce({ data: { ciphertext: 'encrypted' } });
    await expect(finishWorkspaceOAuth(state, 'code', started.binding)).rejects.toThrow('changed');
  });

  it('drops an expired credential and clears copies for that connection', async () => {
    configure(); vi.stubEnv('KNOWBRIDGE_WORKSPACE_ENABLED', 'true');
    const identity = { uid: 'owner', tenantId: 'fictional' };
    const key = createHash('sha256').update(JSON.stringify([identity.tenantId, identity.uid])).digest('hex');
    mocks.records.set(`workspace_connections/${key}`, { ...identity, ownerUid: identity.uid, id: 'expired-connection',
      generation: 1, subject: 'fictional-account', active: true, expiresAt: Date.now() - 1, ciphertext: 'encrypted' });
    mocks.kms.mockRejectedValueOnce(new Error('KMS unavailable'));
    await expect(getWorkspaceConnection(identity)).rejects.toThrow('Reconnect');
    const stored = mocks.records.get(`workspace_connections/${key}`) as { active: boolean; ciphertext?: string };
    expect(stored.active).toBe(false); expect(stored.ciphertext).toBeUndefined();
    expect(mocks.clear).toHaveBeenCalledWith(identity, {}, 'expired-connection');
  });

  it('stale maintenance cannot disable or revoke a replacement connection', async () => {
    configure();
    const identity = { uid: 'owner', tenantId: 'fictional' };
    const key = createHash('sha256').update(JSON.stringify([identity.tenantId, identity.uid])).digest('hex');
    const replacement = { ownerUid: identity.uid, tenantId: identity.tenantId, id: 'new-connection',
      generation: 4, subject: 'fictional-account', active: true, expiresAt: Date.now() + 60000, ciphertext: 'new-encrypted' };
    mocks.records.set(`workspace_connections/${key}`, replacement);
    await expect(disconnectWorkspaceConnection(identity, { id: 'old-connection', generation: 2 }))
      .resolves.toEqual({ revocation: 'unconfirmed', connectionId: 'old-connection' });
    expect(mocks.records.get(`workspace_connections/${key}`)).toEqual(replacement);
    expect(mocks.kms).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});

