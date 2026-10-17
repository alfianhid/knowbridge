// Trusted operator CLI. Credentials stay in memory; only the ID token enters the clipboard.
const { applicationDefault, cert, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { readFile } = require('node:fs/promises');
const { spawn } = require('node:child_process');

const PROJECT = 'project-abfa2050-4777-4f90-bf0';
const UID = 'knowbridge-demo-reviewer';
const ORIGIN = 'https://knowbridge-208529907910.asia-southeast1.run.app';
const KEY_NAME = 'projects/208529907910/locations/global/keys/21f0fe91-0d21-4cc0-ac63-cfafaecf8192';
let stage = 'inputs';

async function copyToken(token) {
  if (process.platform !== 'win32') throw new Error('clipboard-platform');
  await new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'Set-Clipboard -Value ([Console]::In.ReadToEnd())'], { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', () => reject(new Error('clipboard-failed')));
    child.stdin.on('error', () => reject(new Error('clipboard-failed')));
    child.on('exit', code => code === 0 ? resolve() : reject(new Error('clipboard-failed')));
    child.stdin.end(token);
  });
}

async function main() {
  const flags = process.argv.slice(2);
  if (flags.some(flag => !['--clipboard', '--revoke'].includes(flag)) || flags.length !== 1) {
    throw new Error('usage: node scripts/prepare-judge-access.cjs --clipboard OR --revoke');
  }
  const credential = applicationDefault();
  const auth = getAuth(initializeApp({ projectId: PROJECT, credential,
    serviceAccountId: `firebase-adminsdk-fbsvc@${PROJECT}.iam.gserviceaccount.com` }));
  stage = 'member-lookup';
  const user = await auth.getUser(UID);
  if (user.disabled || user.customClaims?.knowbridgeMember !== true || user.customClaims?.knowbridgeAdmin === true ||
    user.customClaims?.knowbridgeTenant !== 'demo-north-quay') throw new Error('unexpected-demo-membership');
  if (flags.includes('--revoke')) {
    await auth.revokeRefreshTokens(UID);
    console.log(JSON.stringify({ uid: UID, revoked: true, note: 'Demo reviewer sessions revoked. Clear the clipboard and reload demo tabs.' }));
    return;
  }
  let signer = auth;
  if (process.env.KNOWBRIDGE_TOKEN_SIGNER_FILE) {
    const key = JSON.parse(await readFile(process.env.KNOWBRIDGE_TOKEN_SIGNER_FILE, 'utf8'));
    if (key.project_id !== PROJECT) throw new Error('signer-project-mismatch');
    signer = getAuth(initializeApp({ projectId: PROJECT, credential: cert(key) }, 'judge-signer'));
  }
  stage = 'custom-token-sign';
  const customToken = await signer.createCustomToken(UID);
  stage = 'api-key-lookup';
  let keyString = process.env.KNOWBRIDGE_FIREBASE_API_KEY;
  if (!keyString) {
    const access = await credential.getAccessToken();
    const keyResponse = await fetch(`https://apikeys.googleapis.com/v2/${KEY_NAME}/keyString`, {
      headers: { authorization: `Bearer ${access.access_token}`, 'x-goog-user-project': PROJECT },
      signal: AbortSignal.timeout(30000),
    });
    if (!keyResponse.ok) throw new Error(`api-key-lookup-${keyResponse.status}`);
    ({ keyString } = await keyResponse.json());
  }
  if (typeof keyString !== 'string' || !keyString) throw new Error('api-key-missing');
  stage = 'token-exchange';
  const exchange = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(keyString)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }), signal: AbortSignal.timeout(30000),
  });
  if (!exchange.ok) throw new Error(`token-exchange-${exchange.status}`);
  const { idToken } = await exchange.json();
  if (typeof idToken !== 'string') throw new Error('id-token-missing');
  stage = 'token-verify';
  const verified = await auth.verifyIdToken(idToken, true);
  if (verified.uid !== UID || verified.knowbridgeMember !== true || verified.knowbridgeAdmin === true ||
    verified.knowbridgeTenant !== 'demo-north-quay') throw new Error('token-membership-mismatch');
  stage = 'deployed-access';
  const headers = { authorization: `Bearer ${idToken}` };
  const checks = {};
  for (const path of ['/api/decision-briefs', '/api/workspace/status']) {
    const response = await fetch(`${ORIGIN}${path}`, { headers, signal: AbortSignal.timeout(30000) });
    checks[path] = response.status;
    if (!response.ok) throw new Error(`member-route-${response.status}`);
  }
  const denied = await fetch(`${ORIGIN}/api/ingest`, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(30000),
  });
  if (denied.status !== 403) throw new Error('ingestion-denial-not-confirmed');
  stage = 'clipboard';
  await copyToken(idToken);
  console.log(JSON.stringify({ uid: UID, tenant: verified.knowbridgeTenant, expiresAt: new Date(verified.exp * 1000).toISOString(),
    clipboard: 'ID token copied; paste into both member-token fields. Do not share clipboard history.',
    checks, ingestionDenied: true, note: 'No refresh token or signer key saved. Review acknowledgement remains manual.' }));
}

main().catch(error => {
  // Never print SDK response bodies, which can contain credential/request details.
  const safeMessage = error instanceof Error && /^(usage:|clipboard-|unexpected-demo-membership|signer-project-mismatch|api-key-|token-exchange-|id-token-missing|token-membership-mismatch|member-route-|ingestion-denial-not-confirmed)/.test(error.message)
    ? error.message : 'operator-access-failed';
  console.error(JSON.stringify({ prepared: false, stage, diagnostic: safeMessage,
    code: typeof error?.code === 'string' && /^[a-z0-9/-]+$/i.test(error.code) ? error.code : undefined }));
  process.exitCode = 1;
});
