import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { CodeChallengeMethod, GoogleAuth, OAuth2Client } from 'google-auth-library';
import { ApiError, type BriefIdentity } from './access';
import { getDatabase } from './firebase';
import { getWorkspaceConfig, requireWorkspaceEnabled } from './workspace-config';

export interface WorkspaceConnection { id: string; generation: number; subject: string; expiresAt: number; accessToken: string }
interface StoredConnection { id: string; generation: number; subject: string; expiresAt: number; ciphertext?: string; active: boolean; tenantId: string; ownerUid: string; disconnecting?: boolean; disconnectingUntil?: number; revocation?: 'confirmed' | 'unconfirmed' }
interface OAuthAttempt { tenantId: string; ownerUid: string; binding: string; verifier: string; nonce: string; expiresAt: number; generation: number }
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const ownerId = (identity: BriefIdentity) => digest(JSON.stringify([identity.tenantId, identity.uid]));
const connections = () => getDatabase().collection('workspace_connections');
const attempts = () => getDatabase().collection('workspace_oauth_attempts');
const oauth = () => { const config = getWorkspaceConfig(); const client = new OAuth2Client(config.clientId, config.clientSecret, `${config.origin}/api/workspace/oauth/callback`); client.transporter.defaults = { ...client.transporter.defaults, timeout: 10000 }; return client; };

export function validateOAuthAttempt(attempt: OAuthAttempt | undefined, binding: string, now = Date.now()): asserts attempt is OAuthAttempt {
  if (!attempt || attempt.expiresAt <= now || !binding || binding.length > 256) throw new ApiError(400, 'Workspace sign-in expired or invalid.');
  const actual = Buffer.from(digest(binding));
  const expected = Buffer.from(attempt.binding);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new ApiError(400, 'Workspace sign-in expired or invalid.');
}

async function crypt(operation: 'encrypt' | 'decrypt', value: string, identity: BriefIdentity): Promise<string> {
  const { kmsKey } = getWorkspaceConfig();
  const client = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
  const field = operation === 'encrypt' ? 'plaintext' : 'ciphertext';
  const response = await client.request<Record<string, string>>({ url: `https://cloudkms.googleapis.com/v1/${kmsKey}:${operation}`, method: 'POST', timeout: 10000, data: { [field]: operation === 'encrypt' ? Buffer.from(value).toString('base64') : value, additionalAuthenticatedData: Buffer.from(ownerId(identity)).toString('base64') } });
  const result = response.data[operation === 'encrypt' ? 'ciphertext' : 'plaintext'];
  if (!result) throw new ApiError(503, 'Workspace credential encryption unavailable.');
  return operation === 'encrypt' ? result : Buffer.from(result, 'base64').toString('utf8');
}

async function revokeAccessToken(token: string): Promise<'confirmed' | 'unconfirmed'> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(10000) });
    return response.ok ? 'confirmed' : 'unconfirmed';
  } catch { return 'unconfirmed'; }
}

export async function startWorkspaceOAuth(identity: BriefIdentity): Promise<{ authorizationUrl: string; binding: string }> {
  requireWorkspaceEnabled();
  const state = randomBytes(32).toString('base64url');
  const binding = randomBytes(32).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  const ref = connections().doc(ownerId(identity));
  await getDatabase().runTransaction(async transaction => {
    const connection = (await transaction.get(ref)).data() as StoredConnection | undefined;
    if (connection?.active || (connection?.disconnecting && (connection.disconnectingUntil ?? Infinity) > Date.now())) throw new ApiError(409, 'Disconnect the current Workspace account first.');
    transaction.create(attempts().doc(digest(state)), { tenantId: identity.tenantId, ownerUid: identity.uid, binding: digest(binding), verifier, nonce, expiresAt: Date.now() + 300000, generation: connection?.generation ?? 0 });
  });
  return { binding, authorizationUrl: oauth().generateAuthUrl({ access_type: 'online', scope: ['openid', 'https://www.googleapis.com/auth/drive.file'], state, nonce, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: CodeChallengeMethod.S256, prompt: 'select_account consent' }) };
}

export async function finishWorkspaceOAuth(state: string, code: string, binding: string): Promise<void> {
  requireWorkspaceEnabled();
  if (!/^[A-Za-z0-9_-]{43}$/.test(state) || !code || code.length > 4096) throw new ApiError(400, 'Workspace sign-in invalid.');
  const attemptRef = attempts().doc(digest(state));
  const attempt = await getDatabase().runTransaction(async transaction => {
    const value = (await transaction.get(attemptRef)).data() as OAuthAttempt | undefined;
    validateOAuthAttempt(value, binding);
    transaction.delete(attemptRef);
    return value;
  });
  const identity = { uid: attempt.ownerUid, tenantId: attempt.tenantId };
  const client = oauth();
  const { tokens } = await client.getToken({ code, codeVerifier: attempt.verifier });
  try {
    if (!tokens.id_token || !tokens.access_token || !tokens.expiry_date || tokens.expiry_date <= Date.now() || tokens.refresh_token) throw new ApiError(401, 'Workspace sign-in rejected.');
    const scopes = new Set((tokens.scope ?? '').split(' '));
    if (!scopes.has('openid') || !scopes.has('https://www.googleapis.com/auth/drive.file') || scopes.size !== 2) throw new ApiError(401, 'Workspace consent must contain only the requested scopes. Revoke prior consent and reconnect.');
    const payload = (await client.verifyIdToken({ idToken: tokens.id_token, audience: getWorkspaceConfig().clientId })).getPayload();
    if (!payload || !['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss) || payload.nonce !== attempt.nonce || !getWorkspaceConfig().allowedSubjects.has(payload.sub)) throw new ApiError(403, 'Workspace account is not registered.');
    const ciphertext = await crypt('encrypt', tokens.access_token, identity);
    requireWorkspaceEnabled();
    const ref = connections().doc(ownerId(identity));
    await getDatabase().runTransaction(async transaction => {
      const previous = (await transaction.get(ref)).data() as StoredConnection | undefined;
      if (previous?.active || (previous?.generation ?? 0) !== attempt.generation) throw new ApiError(409, 'Workspace connection changed. Start sign-in again.');
      transaction.set(ref, { id: randomBytes(24).toString('hex'), tenantId: identity.tenantId, ownerUid: identity.uid, generation: attempt.generation + 1, subject: payload.sub, expiresAt: tokens.expiry_date, ciphertext, active: true });
    });
  } catch (error) {
    // A rejected callback must not leave an application-retained credential or unattempted grant cleanup.
    if (tokens.access_token) await revokeAccessToken(tokens.access_token);
    throw error;
  }
}

export async function getWorkspaceConnection(identity: BriefIdentity): Promise<WorkspaceConnection> {
  requireWorkspaceEnabled();
  const record = (await connections().doc(ownerId(identity)).get()).data() as StoredConnection | undefined;
  if (record?.active && record.ownerUid === identity.uid && record.tenantId === identity.tenantId && record.expiresAt <= Date.now()) {
    await disconnectWorkspaceConnection(identity, { id: record.id, generation: record.generation });
    const { clearWorkspaceImports } = await import('./workspace-import');
    await clearWorkspaceImports(identity, {}, record.id);
  }
  if (!record?.active || record.ownerUid !== identity.uid || record.tenantId !== identity.tenantId || record.expiresAt <= Date.now() || !record.ciphertext) throw new ApiError(401, 'Reconnect Workspace before continuing.');
  const accessToken = await crypt('decrypt', record.ciphertext, identity);
  const current = (await connections().doc(ownerId(identity)).get()).data() as StoredConnection | undefined;
  if (!current?.active || current.id !== record.id || current.generation !== record.generation || current.expiresAt <= Date.now()) throw new ApiError(401, 'Workspace connection changed.');
  requireWorkspaceEnabled();
  return { id: record.id, generation: record.generation, subject: record.subject, expiresAt: record.expiresAt, accessToken };
}

export async function workspaceConnectionStatus(identity: BriefIdentity): Promise<{ connected: boolean; expiresAt: number | null; connectionId: string | null; revocation?: 'confirmed' | 'unconfirmed' }> {
  const record = (await connections().doc(ownerId(identity)).get()).data() as StoredConnection | undefined;
  if (record && (record.ownerUid !== identity.uid || record.tenantId !== identity.tenantId)) throw new ApiError(403, 'Workspace access denied.');
  if (record?.active && record.expiresAt <= Date.now()) {
    const result = await disconnectWorkspaceConnection(identity, { id: record.id, generation: record.generation });
    const { clearWorkspaceImports } = await import('./workspace-import');
    await clearWorkspaceImports(identity, {}, record.id);
    return { connected: false, expiresAt: record.expiresAt, connectionId: record.id, revocation: result.revocation };
  }
  return { connected: Boolean(record?.active && record.expiresAt > Date.now() && process.env.KNOWBRIDGE_WORKSPACE_ENABLED === 'true'), expiresAt: record?.expiresAt ?? null, connectionId: record?.id ?? null, ...(record?.revocation ? { revocation: record.revocation } : {}) };
}

export async function disconnectWorkspaceConnection(identity: BriefIdentity, expected?: { id: string; generation: number }): Promise<{ revocation: 'confirmed' | 'unconfirmed'; connectionId: string | null }> {
  const ref = connections().doc(ownerId(identity));
  const previous = await getDatabase().runTransaction(async transaction => {
    const record = (await transaction.get(ref)).data() as StoredConnection | undefined;
    if (record && (record.ownerUid !== identity.uid || record.tenantId !== identity.tenantId)) throw new ApiError(403, 'Workspace access denied.');
    // Expiry and maintenance act on a snapshot; never revoke a later reconnect.
    if (expected && (record?.id !== expected.id || record.generation !== expected.generation)) return null;
    if (record?.disconnecting && (record.disconnectingUntil ?? Infinity) > Date.now()) throw new ApiError(409, 'Workspace disconnect is in progress. Retry shortly.');
    const { ciphertext: removed, ...safe } = record ?? { id: randomBytes(24).toString('hex'), subject: '', expiresAt: 0, tenantId: identity.tenantId, ownerUid: identity.uid, generation: 0, active: false };
    void removed;
    transaction.set(ref, { ...safe, active: false, disconnecting: true, disconnectingUntil: Date.now() + 30000, generation: (record?.generation ?? 0) + 1 });
    return record;
  });
  if (previous === null) return { revocation: 'unconfirmed', connectionId: expected?.id ?? null };
  let revocation: 'confirmed' | 'unconfirmed' = previous?.revocation ?? 'unconfirmed';
  if (previous?.ciphertext) {
    try {
      const token = await crypt('decrypt', previous.ciphertext, identity);
      revocation = await revokeAccessToken(token);
    } catch { revocation = 'unconfirmed'; }
  }
  await getDatabase().runTransaction(async transaction => {
    const current = (await transaction.get(ref)).data() as StoredConnection;
    if (current.generation === (previous?.generation ?? 0) + 1) {
      const { ciphertext: discarded, ...safe } = current;
      void discarded;
      transaction.set(ref, { ...safe, disconnecting: false, revocation });
    }
  });
  return { revocation, connectionId: previous?.id ?? null };
}
