import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFile } from 'node:fs/promises';
import { requireBriefIdentity, requireIngestionAdmin } from '../src/lib/access';
import { getAdminApp } from '../src/lib/firebase';

let stage = 'inputs';

// Explicit operator-only proof for the dedicated fictional user. Never prints token/key material.
async function main(): Promise<void> {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const keyName = process.env.KNOWBRIDGE_FIREBASE_KEY_NAME;
  const signerPath = process.env.KNOWBRIDGE_TOKEN_SIGNER_FILE;
  if (!project || !keyName || !signerPath || !keyName.startsWith('projects/')) throw new Error('Operator inputs missing.');
  stage = 'signer-file';
  const credential = JSON.parse(await readFile(signerPath, 'utf8'));
  if (credential.project_id !== project) throw new Error('Signer project mismatch.');
  const signer = getAuth(initializeApp({ credential: cert(credential), projectId: project }, 'demo-proof-signer'));
  const auth = getAuth(getAdminApp());
  const uid = 'knowbridge-demo-reviewer';
  stage = 'user-lookup';
  const user = await auth.getUser(uid);
  if (user.disabled || user.customClaims?.knowbridgeMember !== true || user.customClaims?.knowbridgeAdmin === true ||
    user.customClaims?.knowbridgeTenant !== 'demo-north-quay') throw new Error('Unexpected demo user role.');
  stage = 'api-key-lookup';
  let key: { keyString?: string } = { keyString: process.env.KNOWBRIDGE_FIREBASE_API_KEY };
  if (!key.keyString) {
    const access = await applicationDefault().getAccessToken();
    const keyResponse = await fetch(`https://apikeys.googleapis.com/v2/${keyName}/keyString`, {
      headers: { authorization: `Bearer ${access.access_token}`, 'x-goog-user-project': project },
    });
    if (!keyResponse.ok) throw new Error(`API key lookup failed (${keyResponse.status}).`);
    key = await keyResponse.json() as { keyString?: string };
  }
  if (!key.keyString) throw new Error('API key missing.');
  stage = 'custom-token-sign';
  const customToken = await signer.createCustomToken(uid);
  stage = 'token-exchange';
  const exchange = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(key.keyString)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  if (!exchange.ok) throw new Error(`Token exchange failed (${exchange.status}).`);
  const result = await exchange.json() as { idToken?: string };
  if (!result.idToken) throw new Error('ID token missing.');
  const request = new Request('http://localhost/operator-check', { headers: { authorization: `Bearer ${result.idToken}` } });
  stage = 'id-token-verification';
  const identity = await requireBriefIdentity(request);
  if (identity.uid !== uid) throw new Error('Wrong verified identity.');
  let ingestionDenied = false;
  try { await requireIngestionAdmin(request); } catch (error) { ingestionDenied = error instanceof Error && 'status' in error && error.status === 403; }
  if (!ingestionDenied) throw new Error('Member must not ingest.');
  // Revocation timestamps have second granularity. Only revoke this dedicated operator-test user's sessions.
  await new Promise(resolve => setTimeout(resolve, 1500));
  stage = 'revocation';
  await auth.revokeRefreshTokens(uid);
  let revokedDenied = false;
  try { await requireBriefIdentity(request); } catch (error) { revokedDenied = error instanceof Error && 'status' in error && error.status === 401; }
  if (!revokedDenied) throw new Error('Revoked token was accepted.');
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), uid, tenant: identity.tenantId, verified: true, ingestionDenied, revokedDenied,
    scope: 'operator custom-token proof; no browser sign-in or human review performed' }));
}
main().catch(error => {
  // SDK error bodies may contain sensitive request metadata; emit only known safe diagnostic codes.
  console.error(JSON.stringify({ verified: false, stage, diagnostic: error instanceof Error && /^(API key lookup failed|Token exchange failed) \(\d{3}\)\.$/.test(error.message) ? error.message : undefined, code: error && typeof error.code === 'string' ? error.code : 'operator-proof-failed' }));
  process.exitCode = 1;
});
